from __future__ import annotations

import asyncio
import contextlib
import time
from collections.abc import Callable
from datetime import UTC, datetime
from uuid import UUID

from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker
from temporalio import activity
from temporalio.exceptions import ApplicationError

from duelo.application.ports import (
    ChangeRepository,
    ProjectPaths,
    ProjectSlugs,
    ReviewAgent,
    ReviewArchive,
    ReviewRepository,
    UnsafeArchiveTarget,
)
from duelo.application.record_review import record_review_failure, record_review_success
from duelo.application.review_notes import render_review_note
from duelo.workflows.dto import (
    ArchiveReviewsInput,
    ArchiveReviewsResult,
    RunReviewInput,
    RunReviewResult,
    result_from_review,
)

# Un tercio del `heartbeat_timeout` (30 s) del workflow: aguanta que se pierda algún latido.
HEARTBEAT_INTERVAL_SECONDS = 10.0

# Mensaje guardado cuando una activity agota sus reintentos. Es fijo a propósito: el texto de la
# excepción original puede arrastrar rutas, SQL o credenciales; el detalle queda en Temporal.
INFRASTRUCTURE_FAILURE_MESSAGE = (
    "Fallo de infraestructura: la review no pudo completarse tras varios intentos"
)


def _temporal_heartbeat(*details: object) -> None:
    # Fuera de una activity (p. ej. un test que llama al método directamente) no hay a quién avisar.
    if activity.in_activity():
        activity.heartbeat(*details)


class ReviewActivities:
    """Activities finas: delegan en los casos de uso de application/.

    No conoce qué adaptador concreto implementa cada puerto (`change_repository` y
    `review_repository` son fábricas inyectadas desde fuera, p. ej. la clase
    `SqlAlchemyChangeRepository` misma) - `workflows/` no puede importar `adapters/`
    directamente (capas hermanas en la regla de `import-linter`), así que la
    composición ocurre en quien construye esta instancia (el worker o el test).
    """

    def __init__(
        self,
        session_factory: async_sessionmaker[AsyncSession],
        change_repository: Callable[[AsyncSession], ChangeRepository],
        review_repository: Callable[[AsyncSession], ReviewRepository],
        agents: dict[str, ReviewAgent],
        heartbeat: Callable[..., None] = _temporal_heartbeat,
        heartbeat_interval: float = HEARTBEAT_INTERVAL_SECONDS,
        # Nota de git de cada run: `None` (o sin carpeta local) = no se escribe.
        archive: ReviewArchive | None = None,
        project_paths: ProjectPaths | None = None,
        project_slugs: ProjectSlugs | None = None,
        clock: Callable[[], datetime] = lambda: datetime.now(UTC),
    ) -> None:
        self._session_factory = session_factory
        self._change_repository = change_repository
        self._review_repository = review_repository
        self._agents = agents
        self._heartbeat = heartbeat
        self._heartbeat_interval = heartbeat_interval
        self._archive = archive
        self._project_paths = project_paths
        self._project_slugs = project_slugs
        self._clock = clock

    async def _beat_until_cancelled(self, details: tuple[object, ...]) -> None:
        """Latido inmediato y luego uno por intervalo, hasta que se cancele la tarea."""
        while True:
            self._heartbeat(*details)
            await asyncio.sleep(self._heartbeat_interval)

    @activity.defn
    async def run_review(self, review_input: RunReviewInput) -> RunReviewResult:
        # Un agente que no existe en el registro es un error de configuración del
        # sistema, no un fallo del agente al revisar: no se reintenta ni se persiste
        # una Review (contaminaría las estadísticas).
        agent = self._agents.get(review_input.agent_name)
        if agent is None:
            raise ApplicationError(
                f"Agente desconocido: {review_input.agent_name}", non_retryable=True
            )

        # El diff nunca viaja por Temporal: la activity carga el Change por su id.
        async with self._session_factory() as session:
            change = await self._change_repository(session).get(UUID(review_input.change_id))

        if change is None:
            raise ApplicationError(f"Change {review_input.change_id} no existe", non_retryable=True)

        start = time.monotonic()
        # Mientras el agente trabaja, Temporal necesita latidos: sin ellos una review de más de
        # `heartbeat_timeout` se daría por perdida y se reintentaría sin motivo.
        beat = asyncio.create_task(
            self._beat_until_cancelled((review_input.change_id, review_input.agent_name))
        )
        try:
            result = await agent.review(change)
        except Exception as exc:  # noqa: BLE001 - el fallo del agente se registra, no se relanza
            duration_ms = int((time.monotonic() - start) * 1000)
            async with self._session_factory() as session:
                review = await record_review_failure(
                    self._review_repository(session),
                    change=change,
                    agent=review_input.agent_name,
                    run=review_input.run,
                    error=str(exc),
                    duration_ms=duration_ms,
                )
            return result_from_review(review)
        finally:
            beat.cancel()
            with contextlib.suppress(asyncio.CancelledError):
                await beat

        duration_ms = int((time.monotonic() - start) * 1000)
        async with self._session_factory() as session:
            review = await record_review_success(
                self._review_repository(session),
                change=change,
                agent=review_input.agent_name,
                run=review_input.run,
                result=result,
                raw_output=None,
                duration_ms=duration_ms,
            )
        return result_from_review(review)

    @activity.defn
    async def record_review_infrastructure_failure(
        self, review_input: RunReviewInput
    ) -> RunReviewResult:
        """Compensación: `run_review` agotó sus reintentos por un fallo de infraestructura y no
        llegó a guardar nada. Registra una review fallida con un mensaje genérico para que el
        change no se quede `pending`/`running` y se pueda reintentar. Es idempotente: la identidad
        natural `(change, agent, run)` hace que repetirla, o que `run_review` hubiera guardado
        algo justo antes, no duplique fila ni evento."""
        async with self._session_factory() as session:
            change = await self._change_repository(session).get(UUID(review_input.change_id))
        if change is None:
            raise ApplicationError(f"Change {review_input.change_id} no existe", non_retryable=True)
        async with self._session_factory() as session:
            review = await record_review_failure(
                self._review_repository(session),
                change=change,
                agent=review_input.agent_name,
                run=review_input.run,
                error=INFRASTRUCTURE_FAILURE_MESSAGE,
            )
        return result_from_review(review)

    @activity.defn
    async def archive_reviews(self, archive_input: ArchiveReviewsInput) -> ArchiveReviewsResult:
        """Guarda las reviews de la run como nota de git del commit, en el repositorio local del
        proyecto, y la empuja al remoto. Nunca falla por git: devuelve `skipped`/`failed` con el
        motivo y el workflow termina igual. Idempotente: la nota se sustituye. Solo un SHA
        inseguro (ingesta maliciosa) la hace fallar, sin reintento."""
        async with self._session_factory() as session:
            change = await self._change_repository(session).get(UUID(archive_input.change_id))
        if change is None:
            raise ApplicationError(
                f"Change {archive_input.change_id} no existe", non_retryable=True
            )
        if self._archive is None or self._project_paths is None:
            return ArchiveReviewsResult("skipped", "las notas de git están desactivadas")
        repo_path = await self._project_paths.path_of(change.project_id)
        if repo_path is None:
            return ArchiveReviewsResult("skipped", "el proyecto no tiene carpeta local")
        async with self._session_factory() as session:
            reviews = await self._review_repository(session).list_for_change(change.id)
        slug = None
        if self._project_slugs is not None:
            slug = await self._project_slugs.slug_of(change.project_id)
        note = render_review_note(
            change,
            reviews,
            project=slug or str(change.project_id),
            run=archive_input.run,
            written_at=self._clock(),
        )
        try:
            outcome = await self._archive.archive(repo_path, change.head_sha, note)
        except UnsafeArchiveTarget as exc:
            raise ApplicationError(str(exc), non_retryable=True) from exc
        return ArchiveReviewsResult(outcome.status, outcome.detail)
