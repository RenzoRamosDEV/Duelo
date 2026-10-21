# Design

## Context

Observado el 2026-10-21 sobre `backend/src/duelo`, rama `fix/backend-correctness-security` (ya
incluye `changes.expected_agents`, `advance_run(expected_agents=...)`, `adapters/git/command.py`
con `run_git` y `MAX_BODY_BYTES`):

- `SqlAlchemyCommitMarks.tracked_commits(project_id)` lee todos los changes `commit` del proyecto
  sin orden ni límite. La ventana de git es el ajuste `reachability_window_commits` (5000), que
  `sweep_project` recibe como `window` y solo pasa a `history.reachable(limit=window)`.
- `GhPrSource.open_prs` lanza un `gh pr diff` por cada PR listada (hasta `MAX_PRS = 30`) dentro
  del adaptador; `sync_pull_requests` ingesta todas. La reingesta de una PR conocida vuelve a
  llamar a `starter.start` (idempotente por workflow id).
- `SqlAlchemyReviewRepository.list_for_change` hace `select(ReviewModel)` (con `raw_output`) de
  todas las runs. Lo usan `get_change_detail`, `retry_review` y la activity `archive_reviews`;
  ninguno lee `raw_output` (la API no lo expone fuera de `GET /reviews/{id}/raw-output`, que usa
  `get`).
- `retry_review`: `changes.get` y `reviews.list_for_change` autoinician una transacción en la
  sesión compartida que sigue abierta durante `starter.start` hasta el `commit()` de
  `advance_run`.
- `TemporalReviewStarter.start` llama a `ProjectSlugs.slug_of` y `ProjectAgents.agents_of` (dos
  sesiones nuevas) aunque `_ingest` ya cargó el `Project` (`slug`, `agents` efectivos).
  `retry_review` llama además a `agents_of` una o dos veces (`expected_agents_of`,
  `expected_agents_for`).
- `run_command` usa `process.communicate()` y recorta después: retiene toda la salida.
- `EventModel` tiene `ix_events_change_id`, pero no índice sobre `project_id` (FK con
  `ON DELETE CASCADE`).
- `db.get_database_url` y `alembic/env.py::get_url` repiten el default de
  `WorkerSettings.database_url`; `composition.py` y `worker.py` ya pasan `settings.database_url`.
- Hay un test de deriva modelo/migraciones (`test_models_match_the_schema_produced_by_the_migrations`
  con `compare_metadata`).

## Goals / Non-Goals

**Goals:**
- Que el trabajo por ciclo sin novedades sea constante: 0 `gh pr diff` con PRs sin cambios, lectura
  del barrido acotada, sin `raw_output` en lecturas de listado.
- Memoria de `run_command` acotada y ninguna transacción abierta durante una llamada a Temporal.
- Cero cambios en `docs/openapi.json` y en los workflows (no hace falta `workflow.patched`).

**Non-Goals:**
- Lo excluido en la propuesta (trigram, intervalo del barrido, `_legacy_execution_is_taken`).
- Quitar `ProjectSlugs`/`ProjectAgents`: siguen usándolos la activity de notas y el detalle.
- Paginar `gh pr list` más allá de `MAX_PRS`.

## Decisions

**Ventana del barrido: el ajuste existente, no una constante nueva.** El número ya vive en un solo
sitio, `Settings.reachability_window_commits` (5000 por defecto, configurable). `sweep_project`
pasa el mismo `window` a `marks.tracked_commits(project.id, limit=window)` y a
`history.reachable(limit=window)`. Una constante de módulo duplicaría el ajuste o lo volvería
inútil. La consulta añade `.order_by(created_at.desc(), id.desc()).limit(limit)`, que encaja con
`ix_changes_project_kind_created_at_id` (escaneo inverso por `project_id, kind`). El puerto
`CommitMarks.tracked_commits` recibe `limit` como keyword obligatorio; el fake lo respeta.
Alternativa descartada: filtrar por la fecha del commit más antiguo de la ventana de git. Exige
consultar git antes que la base de datos y rompe el orden «leer changes antes de git» que evita
falsos «deshechos».

**Sincronización de PRs: el caso de uso decide qué diffs pedir.**
- `GithubPrSource` se parte en `open_prs(root) -> list[PullRequestInfo]` (solo el listado, un
  `gh pr list`) y `pr_diff(root, number) -> str` (un `gh pr diff`, recortado a
  `MAX_DIFF_CHARS`). `PullRequestInfo` pierde el campo `diff` (ya no lo rellena nadie).
- Nuevo `ChangeRepository.registered_heads(project_id, kind, head_shas) -> frozenset[str]`: un
  `SELECT head_sha ... WHERE project_id = :p AND kind = :k AND head_sha IN (...)`, cubierto por
  `uq_changes_natural_key`. Lista vacía → conjunto vacío sin consulta.
- `sync_pull_requests(projects, changes, github, ingest_pr, slug)`: lista, consulta las cabezas una
  vez y solo para las nuevas pide el diff e ingesta. Las conocidas suman a `synced` (siguen
  sincronizadas) y no a `created`: `{"synced", "created"}` conserva su significado y el contrato
  no cambia. `composition.py` abre una sesión por sincronización para `SqlAlchemyChangeRepository`.
- Alternativa descartada: pasar las cabezas conocidas a `open_prs`. Mete una regla de negocio
  (qué se reingesta) en el adaptador de `gh`.

**Reviews sin `raw_output` y recuento por estado.**
- `list_for_change` carga con `defer(ReviewModel.raw_output, raiseload=True)` y mapea con
  `review_from_row(row, with_raw_output=False)` (devuelve `raw_output=None`): un acceso por
  descuido falla en el test en lugar de lanzar una consulta perezosa. `get` sigue cargándola. El
  docstring del puerto lo deja dicho.
- Nuevo `ReviewRepository.status_counts(change_id, run) -> dict[ReviewStatus, int]`: un
  `SELECT status, count(*) ... WHERE change_id = :c AND run = :r GROUP BY status`, cubierto por
  `ix_reviews_change_run_status`. `retry_review` lo pasa a `review_status_from_counts`; el fake lo
  implementa sobre sus reviews.
- Alternativa descartada: una selección explícita de columnas. Duplica el mapeo de `Review` para
  ahorrar una columna; `defer` + `raiseload` da lo mismo con una línea.

**Transacción del reintento: lecturas cortas en el adaptador.** El caso de uso no conoce la
sesión, así que el fin de la transacción vive en el adaptador: un helper de persistencia
`short_read(session, stmt)` ejecuta la consulta dentro de `session.begin()` si la sesión no está
ya en una transacción (y, si lo está, dentro de ella, para no romper a quien la abrió). Lo usan
`SqlAlchemyChangeRepository.get`, `registered_heads` y `SqlAlchemyReviewRepository.status_counts`.
Con eso, en `retry_review` las lecturas terminan con commit antes de `starter.start`, y
`advance_run` abre la suya después.
- Alternativa descartada: un puerto `UnitOfWork` o un `end_read()` en el repositorio. Es una
  abstracción nueva o una fuga de infraestructura al caso de uso para un solo punto.
- Alternativa descartada: que la composición use dos sesiones. El caso de uso intercala lectura,
  arranque y escritura; la composición no puede cortar entre medias.

**Starter sin consultas.**
- Puerto: `ReviewStarter.start(change, *, project_slug: str, agent_names: Sequence[str])`.
  `TemporalReviewStarter.__init__(client)` deja de recibir `agent_names`, `slugs` y
  `project_agents`; `_slug_of`/`_agents_of` desaparecen. `FakeReviewStarter` guarda el slug y los
  agentes recibidos para poder afirmarlos.
- `_ingest` (commits y la reingesta de PRs, que pasa por `ingest_pr`) pasa `project.slug` y
  `project.agents or agent_names`, el mismo valor que ya usa para `expected_agents`.
- `retry_review(changes, reviews, projects, starter, change_id, *, agent_names, now)`: sustituye
  `expected_agents: int` y `project_agents` por el `ProjectRepository` y los agentes configurados.
  Carga el proyecto una vez con el nuevo `ProjectRepository.get(project_id)` (sesión propia, como
  el resto del repositorio); si no existe, `ChangeNotFound` (el borrado es en cascada).
  `agents = project.agents or agent_names`; reviews esperadas del run actual
  `change.expected_agents` si no es `None` y si no `len(agents)`; las del run nuevo, `len(agents)`.
  Es la misma regla que hoy, sin `agents_of`. `expected_agents_for`/`expected_agents_of` quedan
  para `get_change_detail`.
- Consultas por reintento: antes `get`, `list_for_change`, `agents_of` ×1–2, `slug_of`,
  `agents_of` (starter), `advance_run`; después `get`, `projects.get`, `status_counts`,
  `advance_run`. Por ingesta: dos consultas menos (las del starter).
- Alternativa descartada: pasar el `Project` entero al starter. Acopla el puerto de orquestación al
  agregado para usar dos campos.

**`run_command` por bloques.** Sustituye `communicate()` por una corrutina de recogida que escribe
`input` (y cierra stdin; un `BrokenPipeError` se ignora, como hoy) y lee stdout y stderr en
paralelo por bloques de `CHUNK_BYTES = 65_536`. Cada lector acumula hasta `limit + 1` bytes; a
partir de ahí sigue leyendo y **descarta** el resto hasta el EOF (el proceso termina o vence el
plazo), así que cada buffer no pasa de `limit + 1` y el total retenido queda por debajo de
`2 × limit` más un bloque. Superar `limit` (no alcanzarlo: el borde exacto no recorta) marca
`truncated`. El proceso **no se mata** por exceso de salida: el plazo y la cancelación envuelven la
recogida entera, como hoy, y son lo único que lo mata. `returncode` es el real del proceso.
- `gh_cli._gh` no cambia: sigue mirando solo `returncode` y devolviendo `stdout`. Un diff
  recortado que termina bien sigue siendo un diff (se recorta igualmente a `MAX_DIFF_CHARS` y la
  ingesta marca `diff_truncated`); un listado recortado falla al parsear el JSON y da
  `GithubUnavailable`, como hoy. Claude y `history.py` ya miran `truncated` primero.
- Alternativa descartada: matar el proceso al superar el límite. Haría fallar con `CliFailed`
  reviews de Codex que hoy terminan bien con su stdout recortado (Codex lee el resultado de `-o`):
  una regresión. Un proceso desbocado que no termina lo sigue cortando el plazo existente.

**Índice de eventos.** Revisión nueva sobre `j0b8c2e6f459`: `op.create_index("ix_events_project_id",
"events", ["project_id"])`, `downgrade` con `drop_index`. `EventModel.__table_args__` declara
`Index("ix_events_project_id", "project_id")` para que el test de deriva no vea diferencias. Sin
`CONCURRENTLY`: la tabla es de un solo usuario y el bloqueo dura lo que tarda en construirse.

**URL de la base de datos.** Se elimina `get_database_url`; `create_engine(database_url: str)` la
exige (sus llamadores ya la pasan). `alembic/env.py::get_url` devuelve
`WorkerSettings().database_url`, no `Settings()`: `Settings` exige `INGEST_TOKEN`, que una
migración no necesita, y `database_url` se define en `WorkerSettings`. Los tests de migración ya
fijan `DATABASE_URL` en el entorno, que `WorkerSettings` lee. `test_db_config.py` pierde los tests
del default y del entorno; el default queda cubierto por `tests/unit/test_config.py`.

## Risks / Trade-offs

- [Un commit antiguo fuera de los 5000 más recientes deja de evaluarse aunque git lo tenga en la
  ventana] → Es lo pedido (sus marcas no cambian); afecta solo a proyectos con más changes que la
  ventana y se corrige subiendo `REACHABILITY_WINDOW_COMMITS`.
- [Una PR conocida cuyo workflow falló ya no se relanza en la sincronización] → Hoy la reingesta
  la relanzaba de rebote por `ALLOW_DUPLICATE_FAILED_ONLY`. El camino previsto es
  `POST /changes/{id}/retry`; se anota en el README si lo menciona.
- [Un proceso desbocado que no termina sigue consumiendo CPU hasta el plazo] → Su salida ya no
  ocupa memoria (se descarta) y el plazo existente lo mata como hoy; matarlo antes rompería las
  reviews de Codex que terminan bien con stdout recortado.
- [`short_read` cambia cuándo termina la transacción de `get`] → Solo si la sesión no estaba ya en
  una; los llamadores actuales (`get_change_detail`, activities) leen en sesiones propias y no
  escriben después en la misma transacción. Lo cubren los tests de integración existentes.
- [Firma del puerto `ReviewStarter`] → Interna; se actualizan el adaptador, `FakeReviewStarter` y
  los tests de `tests/integration/orchestration`.
- No hay desviaciones del stack ni de la arquitectura fijada: no procede ADR.

## Migration Plan

1. Desplegar el código y aplicar la migración (`just migrate`); no exige parar el worker.
2. Rollback: `alembic downgrade -1` elimina el índice; el código anterior no depende de él.
Commits atómicos por bloque: `perf(persistence)` barrido, `perf(github)` sincronización,
`perf(persistence)` reviews y recuento, `fix(application)` transacción del reintento,
`perf(subprocess)` salida acotada, `perf(persistence)` índice, `refactor(orchestration)` starter,
`refactor(persistence)` URL.

## Decisiones tomadas en modo autónomo

- Ventana compartida = el ajuste `reachability_window_commits`, no una constante nueva.
- Las PRs conocidas cuentan en `synced` (contrato intacto).
- Fin de la transacción con `short_read` en el adaptador, sin puerto nuevo.
- `retry_review` carga el `Project` con `ProjectRepository.get(project_id)` (método nuevo) en lugar
  de `slug_of` + `agents_of`.
- `alembic/env.py` lee `WorkerSettings`, no `Settings`.
- `run_command` no mata al superar `max_output_bytes`: deja de acumular, descarta el resto hasta
  que el proceso termina o vence el plazo, marca `truncated` y devuelve el `returncode` real.
  `gh_cli` conserva su comportamiento (no mira `truncated`). Corrección posterior a la propuesta
  para no romper las reviews de Codex con stdout recortado.
