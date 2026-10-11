## Context

`AGENT_NAMES` (global) decide a la vez qué agentes tiene el worker, qué agentes arranca la API (`TemporalReviewStarter`, ingesta de PR) y cuántos reviews espera `review_status` (`expected_agents = len(AGENT_NAMES)`). Los workflows ya reciben `agent_names` en su entrada (`ReviewCommitInput`), así que Temporal no cambia.

## Goals / Non-Goals

**Goals:** elegir por proyecto Claude, Codex o ambos; que ingesta, reintentos y estado respeten esa elección; hacerlo desde Ajustes sin reiniciar nada.

**Non-Goals:** elegir por commit; añadir agentes nuevos desde la UI (siguen saliendo de `AGENT_NAMES`); relanzar o borrar reviews ya existentes; cambiar el voto ciego.

## Decisions

- **Por proyecto, no global ni por commit.** Es lo que cuadra con el modelo (cada repo es un canal) y no pide decidir en cada push. `AGENT_NAMES` pasa a ser el conjunto *disponible*; la selección es un subconjunto.
- **Persistencia:** `projects.agents` como `ARRAY(String)` nullable. `NULL` = todos los disponibles (por eso la migración no toca filas existentes y el comportamiento por defecto no cambia). La selección efectiva = guardada ∩ disponibles, en el orden de `AGENT_NAMES`; si el cruce queda vacío (se quitó un agente de `AGENT_NAMES`) se usan todos los disponibles.
- **Escritura:** `PUT /projects/{slug}/agents` con `{"agents": ["claude"]}`. Exige `X-Ingest-Token` y cuenta contra el límite de peticiones, pero NO depende de `LOCAL_PROJECTS_ENABLED`: no toca el disco y debe valer también para proyectos sin carpeta. 422 si la lista está vacía, repite nombres o trae uno no disponible; 404 si el proyecto no existe; 401 sin token.
- **Starter por change:** `TemporalReviewStarter.start` resuelve los agentes del proyecto del change (ya consulta el slug del proyecto) en lugar de usar la lista global; la ingesta de PR (`agent_names` para reutilizar reviews) hace lo mismo. Un puerto pequeño `ProjectAgents.agents_of(project_id)` evita acoplar la aplicación a SQLAlchemy.
- **Agentes esperados por proyecto:** `composition.py` calcula `expected_agents` por lectura a partir del proyecto, no de un `len()` fijo. El filtro por estado del listado (SQL) recibe el mismo número.
- **Cambios con reviews de agentes ya no elegidos:** el estado cuenta las reviews del `run` actual contra el número esperado; si hay más reviews que esperados el change es «completado» (nunca «en curso»). Se documenta y se prueba; no se migran ni se esconden reviews.
- **Voto ciego con un solo agente:** el voto compara dos reviews, así que con un agente elegido no hay duelo que votar. El comportamiento del voto no cambia; solo hay que comprobar en el front que un change con una review no muestra un voto imposible.
- **UI:** en `ProjectsSettings`, por proyecto, casillas de los agentes de `/health` (`agent_names`), «Guardar» deshabilitado con 0 marcadas, mensaje de éxito/error como el resto de acciones y token de ingesta ya existente.

## Risks / Trade-offs

- Cambiar la selección con commits en vuelo: los que ya arrancaron siguen con los agentes con los que nacieron (van en la entrada del workflow); aplica desde el siguiente. Se avisa en la UI.
- Reintentar un change tras cambiar la selección usa la selección nueva: puede pedir un agente que no tenía review. Aceptado: es lo esperado al reintentar.
- Una selección guardada con nombres que luego salen de `AGENT_NAMES` se ignora en silencio (cruce); no falla la ingesta.

## Migration Plan

Migración Alembic que añade `agents` nullable; sin backfill. Reversible quitando la columna. Despliegue: migrar, luego API; el worker no cambia.

## Open Questions

Ninguna que bloquee; se asume token de ingesta (no sesión) para el cambio, igual que alta, baja y reintento.
