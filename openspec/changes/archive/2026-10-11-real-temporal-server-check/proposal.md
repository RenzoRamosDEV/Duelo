# Proposal

## Why

La noche del 2026-10-10 las reviews de un push de 8 commits tardaron 20 minutos en arrancar y dos
quedaron «revisando…» hasta la mañana siguiente (`URGENTE-REVISAR-TEMPORAL-TARDIO.txt`). Las
historias de Temporal y la tabla `reviews` dicen qué pasó de verdad: (1) el único worker vivo
entre las 22:11 y las 22:32 UTC corría código con `versioning_behavior=AUTO_UPGRADE`, que el
servidor real rechaza en cada activación («deployment must be set…») y el servidor de test
acepta, así que todos los workflow tasks vencían en silencio cada 10 s; (2) desde las 22:35 no
hubo ningún worker hasta las 09:46 del día siguiente, momento en que todo terminó solo. El
primer fallo ya está corregido en el código (`fix-workflow-versioning-declaration`), pero nada
impide que se repita con otra opción del `Worker` o de `@workflow.defn`: la suite de integración
solo usa el servidor de test (time-skipping), que no valida esas opciones como el real. El
segundo no es un defecto del producto.

## What Changes

- **Test de integración contra el servidor real de Temporal**: `WorkflowEnvironment.start_local()`
  arranca el servidor de desarrollo de Temporal (el binario `temporal`, mismo código que el
  servidor de producción; se descarga una vez y se cachea). El test construye los workers con
  `build_workers` (el mismo código que `just worker`), ejecuta `ReviewCommitWorkflow` de punta a
  punta con los agentes de prueba y Postgres real, y falla con plazo acotado si el servidor
  rechaza alguna opción del worker o de los workflows. Comprobado: con `versioning_behavior`
  declarado el servidor local lo rechaza igual que el 1.26.2 y el test falla; sin él, pasa.
- **Postmortem verificado** en `docs/postmortems/2026-10-10-reviews-tardias.md` (cronología con
  evidencia de las historias y de la base de datos, causas, qué se arregló, qué no era un fallo)
  y **borrado de `URGENTE-REVISAR-TEMPORAL-TARDIO.txt`**, cuyas hipótesis eran incorrectas en
  parte (las reviews «sin filas» de los merges existían; la activity «que nunca arrancó» había
  terminado; el worker que creía vivo no lo estaba).
- Docs: `docs/testing.md` (la comprobación contra el servidor real deja de ser manual),
  `docs/adr/0007` (decisión 1: la validación contra el servidor real es un test de CI) y la matriz
  `docs/temporal-buenas-practicas.md` (TEST-1).
- Sin cambios de comportamiento del sistema: `skip_specs: true`.

## Capabilities

### New Capabilities

### Modified Capabilities

## Impact

- Tests: `backend/tests/integration/workflows/test_real_server.py` (nuevo); fixture
  `local_temporal_env` en `tests/integration/conftest.py`.
- CI: el primer uso descarga el binario del servidor de desarrollo (decenas de MB) a la caché
  temporal del runner; en local queda cacheado entre ejecuciones.
- Docs: los tres ficheros citados y el postmortem nuevo; el TXT de la raíz desaparece.
- Sin cambios en código de producción, API, base de datos ni frontend.
