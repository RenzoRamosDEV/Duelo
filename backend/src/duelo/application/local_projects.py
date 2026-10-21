"""Alta y baja de proyectos desde carpetas locales y sincronización de sus PRs."""

from __future__ import annotations

import logging
from collections.abc import Awaitable, Callable
from dataclasses import dataclass
from pathlib import Path
from uuid import uuid4

from duelo.application.ingest_commit import ChangeSubmission, IngestResult, ProjectNotFound
from duelo.application.ports import (
    ChangeRepository,
    GithubPrSource,
    GitRepository,
    HookInstaller,
    HookInstallError,
    InvalidRepository,
    ProjectCatalog,
    ProjectRepository,
)
from duelo.domain.change import ChangeKind
from duelo.domain.project import InvalidSlug, Project, slug_for_repository

logger = logging.getLogger(__name__)


class ProjectHasNoFolder(Exception):
    """El proyecto no se dio de alta desde una carpeta: no hay repo del que leer PRs."""

    def __init__(self, slug: str) -> None:
        super().__init__(f"El proyecto {slug} no tiene carpeta local")
        self.slug = slug


class HookRemovalFailed(Exception):
    """No se pudieron quitar los hooks de la carpeta del proyecto: el proyecto se conserva."""

    def __init__(self, slug: str, path: str) -> None:
        super().__init__(
            f"No se pudieron quitar los hooks de Duelo de {path}. Revisa los permisos de "
            f"{path}/.git/hooks y repite la baja de {slug}."
        )
        self.slug = slug
        self.path = path


@dataclass(frozen=True, slots=True)
class SyncResult:
    synced: int
    created: int


async def add_local_project(
    git: GitRepository, hooks: HookInstaller, catalog: ProjectCatalog, path: str
) -> Project:
    """Valida `path`, registra el proyecto y le instala los hooks.

    El proyecto se guarda antes de tocar el disco (así un slug o carpeta repetidos dan 409 sin
    escribir nada) y se borra de nuevo si los hooks no se pueden instalar."""
    info = await git.inspect(path)
    try:
        slug, github = slug_for_repository(info.remote_url, Path(info.root).name)
    except InvalidSlug as exc:
        raise InvalidRepository(str(exc)) from exc
    project = await catalog.add_local(
        Project(id=uuid4(), slug=slug, path=info.root, hooks_installed=True, github=github)
    )
    try:
        await hooks.install(info.root, slug=slug)
    except BaseException:
        await catalog.remove(slug)
        raise
    return project


async def remove_local_project(
    hooks: HookInstaller, projects: ProjectRepository, catalog: ProjectCatalog, slug: str
) -> None:
    """Quita los hooks (si hay carpeta) y SOLO si se lograron elimina el proyecto con sus changes,
    reviews y eventos. Si los hooks no se pueden quitar, lanza `HookRemovalFailed` y no toca nada:
    borrar antes dejaría hooks activos con el token y sin registro desde el que reintentar."""
    project = await projects.get_by_slug(slug)
    if project is None:
        raise ProjectNotFound(slug)
    if project.path is not None:
        try:
            await hooks.uninstall(project.path)
        except (HookInstallError, OSError) as exc:
            logger.warning("No se pudieron quitar los hooks de %s", slug, exc_info=True)
            raise HookRemovalFailed(slug, project.path) from exc
    if await catalog.remove(slug) is None:
        raise ProjectNotFound(slug)  # otra baja se adelantó entre la búsqueda y el borrado


async def sync_pull_requests(
    projects: ProjectRepository,
    changes: ChangeRepository,
    github: GithubPrSource,
    ingest_pr: Callable[[ChangeSubmission], Awaitable[IngestResult]],
    slug: str,
) -> SyncResult:
    """Registra como change `pr` cada PR abierta del repo del proyecto (idempotente por sha).

    Solo se descarga el diff (y se ingiere) de las PRs cuya cabeza aún no es un change `pr`: las
    ya registradas siguen sincronizadas sin coste. Su review, si falló, se relanza con el
    reintento, no aquí."""
    project = await projects.get_by_slug(slug)
    if project is None:
        raise ProjectNotFound(slug)
    if project.path is None:
        raise ProjectHasNoFolder(slug)
    pulls = await github.open_prs(project.path)
    known = await changes.registered_heads(
        project.id, ChangeKind.PR, [pull.head_sha for pull in pulls]
    )
    synced = created = 0
    for pull in pulls:
        if pull.head_sha in known:
            synced += 1
            continue
        try:
            result = await ingest_pr(
                ChangeSubmission(
                    project=slug,
                    ref=pull.ref,
                    head_sha=pull.head_sha,
                    title=pull.title,
                    author=pull.author,
                    url=pull.url,
                    diff=await github.pr_diff(project.path, pull.number),
                )
            )
        except ValueError:
            # Una PR que rompe los límites del dominio (título enorme...) no debe tirar las demás.
            logger.warning("PR #%s de %s descartada: datos fuera de límites", pull.number, slug)
            continue
        synced += 1
        created += result.created
    return SyncResult(synced=synced, created=created)


async def sync_all_pull_requests(
    catalog: ProjectCatalog, sync: Callable[[str], Awaitable[SyncResult]]
) -> dict[str, SyncResult]:
    """Sincroniza las PRs de todos los proyectos locales. Un proyecto que falla (sin `gh`, carpeta
    borrada...) se registra en el log y no impide los demás."""
    results: dict[str, SyncResult] = {}
    for project in await catalog.list_local():
        try:
            results[project.slug] = await sync(project.slug)
        except Exception:
            logger.warning("No se pudieron sincronizar las PRs de %s", project.slug, exc_info=True)
    return results
