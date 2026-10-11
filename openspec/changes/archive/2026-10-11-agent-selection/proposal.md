# Proposal

## Why

Hoy todos los commits y PRs los revisan siempre los agentes de `AGENT_NAMES` (Claude y Codex), en cualquier proyecto. Para gastar menos suscripción, o en un repo donde solo interesa un revisor, no hay forma de elegir: hay que reiniciar API y worker con otra variable de entorno, y vale para todos los proyectos a la vez.

## What Changes

- Cada proyecto guarda qué agentes lo evalúan: uno de los configurados (`claude` o `codex`) o varios. Sin elección guardada, evalúan todos los configurados, como hasta ahora.
- Nuevo endpoint `PUT /projects/{slug}/agents` (con `X-Ingest-Token`) para fijar la selección; `GET /projects` y la lista de proyectos devuelven la selección efectiva (`agents`).
- La ingesta de commits y PRs, y el reintento de reviews, arrancan solo a los agentes elegidos del proyecto, y el estado de cada change («completado», «en curso»…) se calcula con ese número de agentes esperados.
- Pantalla de Ajustes: por cada proyecto, casillas Claude / Codex (mínimo una) con el estado guardado.
- La selección aplica a lo que se ingiera o reintente a partir de guardarla: las reviews ya hechas no se borran ni se relanzan.

## Capabilities

### New Capabilities
- `agent-selection`: elección por proyecto de los agentes que evalúan, su persistencia, el endpoint para cambiarla, su efecto en ingesta, reintentos y estado, y el control en Ajustes.

### Modified Capabilities

(ninguna: el comportamiento nuevo vive en la capacidad nueva; sin selección guardada nada cambia.)

## Impact

- Backend: columna `projects.agents` (migración Alembic, nullable), `Project` de dominio, `ProjectRepository`, `TemporalReviewStarter` (agentes por change en vez de globales), `composition.py` (agentes esperados por proyecto), router de proyectos, esquemas y OpenAPI.
- Frontend: cliente generado, `ProjectsSettings`, contexto de proyectos; la lista de agentes del front sigue saliendo de `/health`.
- Sin cambios en Temporal (los workflows ya reciben `agent_names` por entrada), en el voto ciego ni en los workers.
