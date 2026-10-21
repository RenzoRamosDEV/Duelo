# Proposal

## Por qué

Varios procesos del backend hacen un trabajo que crece con el historial o con las PRs abiertas
aunque no haya nada nuevo: cada 15 s el barrido de alcanzabilidad lee todos los commits del
proyecto; la sincronización de PRs descarga con `gh pr diff` el diff de todas las PRs abiertas (30
llamadas por ciclo con 30 PRs sin cambios); el detalle y el reintento cargan el `raw_output` de
todas las runs; el reintento deja una transacción abierta mientras espera a Temporal; el starter
vuelve a consultar el slug y los agentes que el caso de uso ya tenía; `run_command` lee en memoria
toda la salida antes de recortarla; y borrar un proyecto barre entera la tabla `events`.

## Qué cambia

- **Barrido**: la lectura de commits seguidos devuelve como mucho los `REACHABILITY_WINDOW_COMMITS`
  (5000) más recientes, el mismo valor que la ventana de `git log`; los de fuera no cambian de
  marca.
- **Sincronización de PRs**: una sola consulta dice qué cabezas ya están registradas como change
  `pr`; solo se descarga el diff (y se ingesta) de las PRs con una cabeza nueva. El puerto
  `GithubPrSource` separa el listado del diff.
- **Lectura de reviews**: `list_for_change` deja de cargar `raw_output`; nuevo
  `ReviewRepository.status_counts(change_id, run)` (un `GROUP BY status`), que usa `retry_review`.
- **Transacción del reintento**: ninguna transacción queda abierta en la sesión durante
  `starter.start`.
- **Salida acotada**: `run_command` lee por bloques, deja de acumular al llegar a
  `max_output_bytes`, descarta el resto hasta que el proceso termina y marca `truncated`; el plazo
  sigue siendo lo único que mata el proceso.
- **Índice**: migración con `ix_events_project_id` sobre `events(project_id)`, declarado también
  en `models.py`.
- **Starter**: `ReviewStarter.start(change, *, project_slug, agent_names)` recibe el slug y los
  agentes del caso de uso (`_ingest`, `retry_review`); `TemporalReviewStarter` deja de consultar
  la base de datos. **BREAKING** (interno): firma del puerto y de sus fakes.
- **Configuración**: se elimina `get_database_url`; `create_engine` exige la URL y
  `alembic/env.py` la lee de `WorkerSettings`.

Fuera de alcance: índices trigram para la búsqueda del canal, cambiar
`REACHABILITY_SWEEP_INTERVAL_SECONDS`, retirar `_legacy_execution_is_taken` y cualquier cambio de
contrato HTTP.

## Capacidades

### Nuevas capacidades

(ninguna)

### Capacidades modificadas

- `commit-state`: la lectura del barrido se acota a la ventana de commits más recientes.
- `local-projects`: la sincronización no descarga ni reingesta las PRs cuya cabeza ya está
  registrada.
- `review-retry`: el reintento no consulta reviews completas ni retiene una transacción mientras
  arranca la ejecución.
- `review-raw-output`: la salida cruda solo se lee en su endpoint.
- `cli-review-agents`: la memoria que retiene la lectura de un programa externo está acotada; el
  programa que se pasa del límite no se mata y termina (o lo corta el plazo) como hasta ahora.

El starter, el índice de `events` y la URL de la base de datos no cambian comportamiento
observable: no llevan delta.

## Impacto

- Backend: `adapters/persistence/{commit_marks,review_repository,change_repository,
  project_repository,models,db}.py`, `adapters/subprocess_runner.py`, `adapters/github/gh_cli.py`,
  `adapters/orchestration/temporal_review_starter.py`, `application/{reachability,local_projects,
  ingest_commit,retry_review}.py`, `application/ports/{git,github,changes,reviews,projects,
  orchestration}.py`, `composition.py`, `alembic/env.py`, una migración Alembic nueva, y los
  fakes de `tests/fakes/`.
- `docs/openapi.json` no cambia: `{"synced", "created"}` conserva su significado.
- Sin dependencias nuevas.
- Done-when: los escenarios de las deltas cubiertos por tests, la medición de `gh pr diff` con
  30 PRs sin cambios pasa de 30 a 0, y `just ci` en verde.
