# Tasks

## 1. Test contra el servidor real

- [x] 1.1 Fixture `local_temporal_env` en `backend/tests/integration/conftest.py` (`WorkflowEnvironment.start_local()`, de función) y `tests/integration/workflows/test_real_server.py`: `build_workers` con `WorkerSettings(database_url=…)` y agentes de prueba, ambos workers arriba, un `Change` persistido, `execute_workflow(ReviewCommitWorkflow.run, …, execution_timeout=45 s)` y dos reviews `completed` en la base de datos; mensaje de fallo que apunte al log del worker. Verificación: `uv run pytest tests/integration/workflows/test_real_server.py --no-cov` en verde en ~2 s; y, poniendo temporalmente `versioning_behavior=VersioningBehavior.AUTO_UPGRADE` en `ReviewCommitWorkflow`, el mismo test falla por plazo agotado (se revierte el cambio temporal antes de seguir).

## 2. Postmortem y documentación

- [x] 2.1 Escribir `docs/postmortems/2026-10-10-reviews-tardias.md` con la cronología verificada (historias de Temporal y filas de `reviews`), las dos causas (worker con `versioning_behavior`; ningún worker entre las 22:35 y las 09:46), lo que se arregló (`fix-workflow-versioning-declaration`, este test), lo que no era fallo (reviews de los merges, review de Claude de `7cbf08c` matada con SIGTERM al parar el worker) y las mejoras pendientes (aviso de review lenta en el frontend). Borrar `URGENTE-REVISAR-TEMPORAL-TARDIO.txt`. Verificación: el postmortem existe, el TXT no, y `grep -rn URGENTE .` solo encuentra `openspec/`.
- [x] 2.2 Actualizar `docs/testing.md` (fila «Operación del worker»: la comprobación contra el servidor real es `test_real_server.py`, no manual), `docs/adr/0007-versionado-de-workflows.md` (decisión 1: validación por test de CI contra el dev server, y además `just dev` + `just worker` para opciones nuevas) y `docs/temporal-buenas-practicas.md` (TEST-1: servidor de test + dev server real; `docs/postmortems/` como evidencia de TEST-3). Verificación: `grep -n "test_real_server" docs/` devuelve las tres referencias.

## 3. Cierre

- [x] 3.1 `just ci` en verde (con `DOCKER_HOST` de Podman y `TESTCONTAINERS_RYUK_DISABLED=true`). Verificación: salida de `just ci` con el test nuevo incluido.

## Workflow follow-up

- Archivar el change (`openspec archive`) y commit/PR junto con `agent-folder-with-skills` cuando el usuario lo pida.
