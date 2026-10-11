# 2026-10-10: reviews que se quedaron «revisando…»

- Impacto: un push de 8 commits a `RenzoRamosDEV/Duelo` a las 22:05 UTC tardó 20 minutos en
  empezar a revisarse y dos commits siguieron «revisando…» hasta la mañana siguiente.
- Duración: 22:11 → 22:32 UTC (todos los commits) y 22:35 → 09:46 UTC del día 11 (`7cbf08c` y
  `67a57ef`).
- Evidencia: historias de Temporal (`fetch_history`) de los workflows `commit-…` y `review-…`
  y la tabla `reviews`, leídas el 11 de octubre. La cronología del aviso que se dejó esa noche
  (`URGENTE-REVISAR-TEMPORAL-TARDIO.txt`, ya borrado) era incorrecta en varios puntos; esta es
  la verificada.

## Cronología (UTC)

| Hora | Hecho | Evidencia |
| --- | --- | --- |
| 22:05 | `git push`; el hook `pre-push` ingiere 8 commits. | Changes en la base de datos |
| 22:11–22:12 | Arrancan 5 workflows `commit-…`. El worker `1369624` toma el primer workflow task de cada uno y **ninguno se completa: vencen a los 10 s** (`WORKFLOW_TASK_TIMED_OUT`). | Eventos 3–4 de cada historia |
| 22:12–22:32 | Nada avanza. Los reintentos del workflow task son transitorios (no quedan en la historia). Ninguna review en la base de datos entre las 22:05 y las 22:30. | Hueco de 1 247 s entre los eventos 4 y 5; `reviews.created_at` |
| 22:28 | Se arranca el worker `1778889` con el código de `main`: mismo fallo. | Historia de `5838cd6` |
| 22:32:52 | Arranca el worker `1786488` con el arreglo `fix-workflow-versioning-declaration`. En 40 s completa los workflow tasks pendientes de los 6 workflows y las reviews salen en 5–33 s (Codex) y 7–104 s (Claude). | Eventos 5–14; filas de `reviews` 22:32:05–22:35:10 |
| 22:34:59 → 22:35:28 | Se pide parar el worker `1786488` mientras Claude revisa `7cbf08c`. A los 30 s de gracia el CLI muere con **SIGTERM (código 143)** y la review se guarda como `failed`; la activity completa y el worker sale. | `reviews.error`; evento 15 del hijo de `7cbf08c` |
| 22:35:28 → 22:35:38 | El siguiente workflow task va a la sticky queue del worker ya muerto, vence a los 10 s (`SCHEDULE_TO_START`) y pasa a la cola normal `platform`. | Eventos 16–18 del hijo |
| 22:35:36 | Nuevo push: arranca `commit-…-67a57ef`. | Historia |
| 22:35:38 → 09:46:10 | **No hay ningún worker.** Ni el hijo de `7cbf08c` ni `67a57ef` registran un solo `WORKFLOW_TASK_STARTED`. El aviso de esa noche decía que el worker seguía vivo: no era así. | Ausencia de eventos; identidades de los workers |
| 09:46:10 (día 11) | Arranca el worker `19801` (`just worker`); ambos workflows completan en segundos. `67a57ef` se revisa (Codex 18 s, Claude 75 s). | Eventos 19–21 |

## Causas

1. **Worker con `versioning_behavior=AUTO_UPGRADE` sin deployment** (change
   `temporal-workflow-good-practices`). El servidor de test (time-skipping) lo acepta; el real
   (`auto-setup` 1.26.2 y el servidor de desarrollo `temporal server start-dev`) rechaza cada
   `RespondWorkflowTaskCompleted` con «deployment must be set when versioning behavior
   specified». El SDK solo lo registra como aviso en el log del worker y el workflow task vence
   cada 10 s sin dejar rastro en la historia: desde fuera parece que «Temporal piensa». El
   worker `1369624`, lanzado por otra sesión desde el árbol de trabajo, ya corría ese código.
2. **Ningún worker entre las 22:35 y las 09:46.** Error de operación: al parar el worker para
   cambiar de prompt no se dejó otro en marcha. No es un defecto del producto; el sistema
   retomó solo en cuanto hubo worker.

## Qué se ha arreglado

- Causa 1, en el código: `fix-workflow-versioning-declaration` quita la declaración (ADR 0007:
  Auto-Upgrade se documenta, no se declara al SDK).
- Causa 1, para que no vuelva con otra opción: `tests/integration/workflows/test_real_server.py`
  (change `real-temporal-server-check`) ejecuta los workers reales de `worker.py` contra el
  servidor de desarrollo real y revisa un commit de punta a punta con plazo acotado. Con
  `versioning_behavior` declarado, el test falla a los 45 s; sin él, pasa en ~2 s.

## Qué no era un fallo

- Las reviews «sin filas» de los merges `92832c1`, `0cc8c81` y `14c3675`: existen las seis,
  completadas a las 22:32 con nota 10. El canal no se había refrescado.
- La activity «que nunca arrancó» del hijo de `7cbf08c`: era la de Claude, completó a las 22:35:28.
- La review de Claude de `7cbf08c` en `failed` («código 143»): el CLI recibió SIGTERM al parar el
  worker (el apagado ordenado espera 30 s y después cancela; el runner mata con SIGKILL, así que el
  SIGTERM vino de fuera, del propio apagado del proceso). El producto registró el fallo como
  resultado, que es el comportamiento previsto; «Reintentar» en el canal lo relanza.
- Los commits `5838cd6`, `6d88778` y `45379e4` son snapshots sintéticos (`git stash create`)
  usados para probar prompts; salen como «commit deshecho» y se pueden ignorar.

## Pendiente (sin decidir)

- El canal marca una review como `stale` a los 1 800 s (`STALE_AFTER_SECONDS`). Con el plazo de
  la activity en 240 s y 3 intentos, una review «revisando…» más de ~13 minutos ya es anómala:
  valorar bajar el umbral o un aviso intermedio en el frontend.
- Un mensaje claro en el worker cuando el servidor rechaza una activación de forma repetida (hoy
  es un `WARN` del SDK), para no depender de leer la historia.
