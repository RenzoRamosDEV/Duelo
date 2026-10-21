# Proposal

## Por qué

Con la configuración por defecto se reproducen cuatro bugs: el navegador no puede guardar los
agentes de un proyecto (el preflight de `PUT` se rechaza por CORS), el hook pierde sin aviso los
commits grandes con texto no ASCII (el cuerpo `\uXXXX` supera el tope de la ingesta), cambiar la
selección de agentes deja atascados en `running` changes ya revisados (el estado se calcula con la
selección actual, no con la del run) y las estadísticas cuentan dos veces las reviews que una PR
reutiliza de su commit. Además, los endpoints de escritura que no son de ingesta leen cuerpos JSON
de cualquier tamaño antes de autenticar, y tres adaptadores de git invocan `git` sin el blindaje
que ya tiene `adapters/git/history.py`; el archivo de notas pasa además el SHA a `git` sin
validarlo.

## Qué cambia

- **CORS**: `allow_methods` pasa a `GET`, `POST`, `PUT`, `DELETE`; las cabeceras no cambian.
- **Hook**: el diff se recorta a 200 000 caracteres (el mismo default que `MAX_DIFF_CHARS`), el
  cuerpo se serializa en UTF-8 sin escapes `\uXXXX` y cada envío fallido escribe una línea en
  stderr con el SHA corto y el motivo, sin cambiar el código de salida.
- **Reviews esperadas por run**: nueva columna `changes.expected_agents` (nullable) con el número
  de agentes del run, guardada al crear el change y en cada reintento; el canal, el detalle y el
  reintento la usan y, si es `NULL`, calculan como hoy. La migración la rellena para los changes
  existentes.
- **Estadísticas**: `GET /stats/agents` deja de contar las reviews reutilizadas, global y por
  proyecto.
- **Límite de cuerpo**: `BodyLimitMiddleware` cubre todo `POST`, `PUT` y `PATCH`; la ingesta
  conserva `MAX_INGEST_BODY_BYTES` y el resto usa el nuevo `MAX_BODY_BYTES` (65 536 por defecto),
  con el mismo 413.
- **Blindaje de git**: un helper único en `adapters/git/` con el entorno y las opciones de
  `history.py`, usado por `history.py`, `notes_archive.py`, `local_repository.py` y
  `hook_installer.py`. `GitNotesArchive.archive` valida el SHA antes de invocar `git`.

Fuera de alcance: `X-Operator-Token` en CORS y todo lo de `raw_output`, separar el token de
ingesta del de administración, el rendimiento de consultas y filtrar secretos del diff.

## Capacidades

### Nuevas capacidades

(ninguna)

### Capacidades modificadas

- `api-cors`: el preflight admite `PUT`.
- `local-projects`: cuerpo del hook acotado y en UTF-8, fallos de envío visibles en stderr, y
  `git` sin configuración ejecutable del repositorio.
- `agent-selection`: el estado se calcula con los agentes del run, no con la selección actual.
- `change-queries`: las métricas por agente excluyen las reviews reutilizadas; el estado agregado
  usa las reviews esperadas del run.
- `change-ingestion`: el límite de cuerpo de la ingesta convive con un límite general.
- `rate-limiting`: límite de cuerpo para el resto de escrituras.
- `review-notes`: un SHA inseguro no llega a `git`.

## Impacto

- Backend: `entrypoints/api/app.py`, `entrypoints/api/body_limit.py`, `entrypoints/hook.py`,
  `config.py`, `composition.py`, `domain/change.py`, `application/{ingest_change,ingest_commit,
  project_agents,queries,retry_review}.py`, `application/ports/{changes,reviews}.py`,
  `adapters/persistence/{models,change_repository,review_repository}.py`, nuevo
  `adapters/git/command.py`, `adapters/git/{history,notes_archive,local_repository,
  hook_installer}.py`, `workflows/activities.py`, una migración Alembic nueva.
- Docs: tabla de variables del README (`MAX_BODY_BYTES`). `docs/openapi.json` no cambia (los
  campos de respuesta son los mismos).
- Sin dependencias nuevas. Los hooks ya instalados no necesitan reinstalarse.
- Done-when: los siete escenarios de las deltas cubiertos por tests y `just ci` en verde.
