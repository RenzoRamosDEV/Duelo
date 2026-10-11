---
name: temporal-review
description: Código de Temporal: determinismo y replay de workflows, versionado de ejecuciones en vuelo, DTOs compatibles y sin datos pesados, activities idempotentes con timeouts y heartbeats, reintentos acotados, task queues por constante y apagado ordenado del worker.
paths:
  - "*workflows/*"
  - "*workflow*.py"
  - "*activities*.py"
  - "*worker*.py"
  - "*task_queue*"
  - "*orchestration/*"
---

Temporal re-ejecuta el código de un workflow desde su historial (replay). Un cambio que altera la secuencia de comandos que el workflow emite rompe las ejecuciones en vuelo, y se descubre tarde. Revisa con más rigor que el código normal.

**Determinismo (código de `@workflow.defn`)**
- Prohibido: reloj del sistema, `random`, `uuid4()`, I/O, red, sleep real (va `workflow.sleep`), lectura de entorno, estado global mutable, imports pesados fuera de `workflow.unsafe.imports_passed_through()`. Todo eso va en activities.
- Orden de comandos estable: `gather` sobre una lista es válido; decidir qué lanzar iterando un `set` o un `dict` sin orden garantizado, no.
- Un workflow recibe un único DTO y devuelve un DTO o primitivo serializable.

**Cambios en workflows ya desplegados**
- Añadir, quitar o reordenar activities, timers o hijos en un workflow que puede tener ejecuciones en vuelo exige `workflow.patched(...)` / `deprecate_patch` o un workflow nuevo con otro nombre. Sin eso es importante; bloqueante si un test de replay o un camino demostrado falla.
- Cambiar el nombre registrado de un workflow, de una activity o de su task queue rompe a quien los llama por string: busca los llamadores si puedes leer el repositorio.
- Opciones nuevas de `@workflow.defn` o del `Worker` (versionado, deployment) deben estar validadas contra un servidor real, no solo contra el entorno de test: el servidor de test acepta combinaciones que el real rechaza.

**DTOs y datos**
- Por Temporal viajan identificadores y primitivos, nunca diffs ni blobs (límite de 2 MB por payload): un campo nuevo que pueda ser grande es importante.
- Un campo nuevo en un DTO lleva valor por defecto (los historiales viejos no lo traen); quitar o renombrar un campo rompe el replay.

**Activities, timeouts y reintentos**
- Idempotencia: reintentar es normal. Efectos con clave natural y `ON CONFLICT`; el éxito se persiste una vez aunque la activity corra dos.
- Una activity con `heartbeat_timeout` debe latir dentro de su trabajo largo, o falla al vencer el plazo aunque siga viva.
- `start_to_close_timeout` acorde con la duración real del trabajo (un proceso externo tarda minutos, no milisegundos como un fake).
- Errores permanentes (configuración, datos inexistentes) como no reintentables; los transitorios con límite de intentos y backoff. Un reintento infinito sobre un error permanente es un bug.
- Un fallo de negocio esperado se registra como resultado, no como excepción que reinicie la activity.
- Workflows de larga vida acotan su historial (Continue-As-New) o justifican que no lo necesitan.

**Arranque, colas y operación**
- Workflow id determinista de negocio; «ya existe» se trata como éxito; política de reuso explícita. El arranque ocurre después de persistir y es reintentable.
- Nombres de task queue desde constantes compartidas; un literal nuevo deja tareas que nadie recoge sin ningún error.
- Política de reintentos compartida con `maximum_interval`; valores sueltos son hallazgo.
- El worker se para por señal con plazo de gracia; métricas solo si se configuran.

**Tests esperados.** Entorno de test con salto de tiempo: paralelismo, fallo parcial, deduplicación por id, worker ausente, fallo transitorio, reintentos acotados, replay de historias grabadas cuando hay parches. Un cambio de workflow sin su test es hallazgo de `test-coverage`.
