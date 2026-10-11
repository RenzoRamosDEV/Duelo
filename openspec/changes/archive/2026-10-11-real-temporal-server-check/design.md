# Design

## Context

- La suite de integración usa `WorkflowEnvironment.start_time_skipping()`: un servidor de test
  (Java) que no aplica las validaciones del servidor real sobre `RespondWorkflowTaskCompleted`.
  Por eso `versioning_behavior` sin deployment pasó toda la suite y rompió las reviews reales.
- `WorkflowEnvironment.start_local()` arranca `temporal server start-dev` (binario del CLI de
  Temporal, descargado por el SDK la primera vez y cacheado en el directorio temporal): es el
  mismo código de servidor que `temporalio/auto-setup`, con persistencia en memoria. Comprobado
  en esta máquina: arranca en 0,1 s con el binario cacheado y rechaza `versioning_behavior` con
  «versioning behavior cannot be specified without deployment options being set with versioned
  mode», igual que el 1.26.2 de `docker-compose.yml`.
- `build_workers(client, settings)` en `worker.py` construye los dos `Worker` reales (opciones de
  `@workflow.defn`, `graceful_shutdown_timeout`, `max_concurrent_activities`); los tests de
  `test_worker_agents.py` ya lo usan contra el servidor de test.

## Goals / Non-Goals

**Goals:**
- Que cualquier opción nueva del `Worker` o de `@workflow.defn` que el servidor real rechace
  rompa la CI, no las reviews del usuario.
- Dejar escrito lo que pasó la noche del 10 de octubre con evidencia, en el sitio donde se
  buscará (docs), y quitar el aviso de la raíz.

**Non-Goals:**
- Sustituir el servidor de test por el real en toda la suite: el salto de tiempo sigue siendo
  necesario para los tests de timeouts y reintentos.
- Probar el servidor de Temporal (que rechace tal opción es cosa suya): el test prueba que
  **nuestros** workers son aceptados.
- Cambiar `STALE_AFTER_SECONDS` o avisar antes en el frontend de una review lenta: se anota en el
  postmortem como posible mejora, sin decidirla aquí.

## Decisions

1. **`start_local()` en vez de testcontainers con `auto-setup` + Postgres.** El dev server es el
   mismo código de servidor, lo gestiona el SDK (sin puertos fijos ni compose), arranca en
   décimas de segundo cacheado y no necesita un segundo contenedor. Alternativa descartada: dos
   contenedores (`auto-setup` 1.26.2 + Postgres) por fidelidad exacta de versión; cuesta ~30 s por
   módulo y la validación que nos importa está en ambos.
2. **Fixture `local_temporal_env`** en `tests/integration/conftest.py`, de función (barata), junto
   a `temporal_env`. Un solo módulo nuevo la usa: `tests/integration/workflows/test_real_server.py`.
3. **Forma del test**: `build_workers` con `WorkerSettings(database_url=<Postgres del test>)` y
   agentes de prueba (`agent_1`, `agent_2`); ambos workers con `async with`; un `Change` persistido
   con los helpers existentes; `execute_workflow(ReviewCommitWorkflow.run, …, task_queue=platform,
   execution_timeout=45 s)`. Si el servidor rechaza una opción, los workflow tasks vencen cada 10 s
   sin dejar rastro y el workflow agota su plazo: el test falla con un mensaje que explica dónde
   mirar (el log del worker, «Error while completing workflow activation»). Al terminar, se
   comprueba que hay dos reviews `completed` en la base de datos, lo que cubre también la queue
   `agents` y la activity real.
4. **Postmortem en `docs/postmortems/`** (carpeta nueva; hasta hoy no había ninguno) con la
   cronología de las historias de Temporal y de `reviews`, no la del TXT. El TXT se borra en el
   mismo change: su contenido útil pasa al postmortem y lo erróneo se corrige ahí.
5. **CI**: sin cambios en `ci.yml`; el runner tiene red y el SDK descarga el binario en el primer
   uso. Si algún día la descarga falla en CI, se fijará `dev_server_download_version` o se
   cacheará el binario; no se adelanta.

## Risks / Trade-offs

- [Descarga del binario en cada run de CI] → decenas de MB una vez por job; aceptable. Mitigación
  futura: caché de GitHub Actions sobre el directorio temporal del SDK.
- [Versión del dev server distinta de la del compose] → la validación que motivó el change está
  en ambas (comprobado); una divergencia futura se vería en `just dev` + `just worker`, que el ADR
  sigue exigiendo para opciones nuevas.
- [45 s de espera cuando falla] → solo en el caso de fallo; en verde dura ~2 s.
