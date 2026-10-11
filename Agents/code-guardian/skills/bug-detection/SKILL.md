---
name: bug-detection
description: Errores reales en el código modificado: condiciones y límites, nulos y tipos, errores y recursos, estado y concurrencia, contratos entre piezas. Solo con un camino de ejecución que los active.
---

Solo cuentan errores con un camino de ejecución real. Cada candidato pasa por `finding-verification`. Por cada bug: ubicación, impacto, cómo se reproduce y arreglo propuesto.

**Condiciones y límites**
- Off-by-one en rangos, `<` frente a `<=`, cortes de cadenas, paginación.
- Valores frontera: vacío, un elemento, máximo permitido, máximo + 1, `0`, negativos.
- Lógica booleana: negaciones, `and`/`or` mal precedidos, condiciones inalcanzables o siempre verdaderas, comparación de floats por igualdad.
- `if x:` donde `0`, `""` o `[]` son valores válidos distintos de `None`.

**Nulos y tipos**
- Un valor opcional (resultado de `get`, consulta que puede no devolver fila, campo opcional) que llega donde se espera uno obligatorio. Si el proyecto tiene comprobación estática estricta, no repitas lo que ya atrapa.
- Conversiones que lanzan (`int()`, UUID, fechas con y sin zona horaria mezcladas).
- Texto: encodings, NUL (rompe algunas bases de datos), Unicode, truncados que parten caracteres.

**Errores y recursos**
- `except` que traga fallos, o tan estrecho que deja escapar los que debía capturar.
- Sesiones, conexiones, clientes o ficheros sin cerrar; falta del gestor de contexto.
- Reintentos sobre operaciones no idempotentes; errores permanentes tratados como transitorios.
- Errores que ocultan la causa original (relanzar sin encadenar la excepción).

**Estado y concurrencia**
- Comprobar-y-luego-actuar: consultar y después insertar sin constraint única.
- Estado mutable compartido entre peticiones o tareas; valores por defecto mutables.
- Corrutina sin esperar, tareas lanzadas y no esperadas, código síncrono pesado que bloquea el event loop.
- Efectos fuera de la transacción que debía ser atómica; commit parcial.

**Contratos entre piezas**
- Un argumento o campo que se acepta pero no se usa ni se reenvía.
- Cambio de firma sin actualizar llamadores, fakes o llamadas por nombre de string.

**Cómo confirmarlo.** Si puedes leer el repositorio: sigue el dato desde donde entra hasta donde falla y busca validaciones, tipos o constraints aguas arriba que lo impidan. Si solo tienes el diff: reporta como `bug` solo lo que el propio diff demuestra; lo demás, si merece la pena, va al resumen como duda.
