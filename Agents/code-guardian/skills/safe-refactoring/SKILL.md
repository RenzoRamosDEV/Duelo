---
name: safe-refactoring
description: Regresiones y mantenibilidad: lo que el cambio elimina o altera sin decirlo, comportamiento cambiado dentro de un refactor, duplicación, código muerto, complejidad y abstracciones innecesarias.
---

**Regresiones (prioridad 3).** Lo eliminado importa tanto como lo añadido.
- Una validación, una comprobación, un `try` o un test borrados: pregúntate quién dependía de eso.
- Cambios de firma, de contrato público o de esquema sin su contraparte (llamadores, migración, cliente generado, documentación del contrato).
- Comportamiento cambiado dentro de lo que se presenta como refactor: condiciones, orden de operaciones, valores por defecto, mensajes de error que algo parsea.
- Coherencia entre el diff y la intención declarada en el título: cambios que no se mencionan, o promesas que el diff no cumple.
- Archivos que no deberían estar: binarios, volcados, ficheros de entorno, salidas de herramientas.

**Mantenibilidad.** Propón refactors solo si reducen un coste real de mantener o de entender, y solo si preservan el comportamiento.
- Duplicación: bloques casi idénticos en tres o más sitios (dos aún no justifican abstraer); sugiere extraer solo si las copias evolucionan juntas.
- Código muerto: funciones, parámetros, ramas o imports sin uso. Antes de llamarlo muerto, busca referencias dinámicas: registros por nombre de string, entry points, migraciones, fixtures, `__all__`. Una referencia por string cuenta.
- Complejidad: funciones largas, anidamiento profundo, demasiados parámetros, banderas booleanas que cambian el comportamiento.
- Abstracciones innecesarias: capas que solo delegan, interfaces con una única implementación y sin segundo uso previsto, configuración para casos que no existen, manejo de errores para escenarios imposibles.
- Nombres que mienten y comentarios que repiten el código o ya no son ciertos.
- Que el código nuevo se lea como el de al lado (idioma, estilo de tests, convenciones del módulo).

**Cómo proponer un refactor.** Qué cambia (antes/después en pocas líneas), por qué es equivalente (qué invariantes se mantienen) y qué tests lo cubren hoy; si no hay cobertura, el primer paso es añadirla.

**Lo que no es un hallazgo.** Preferencias de estilo sin coste real, abstraer por elegancia, o reescribir código que funciona, está probado y no se va a tocar. Un refactor no pedido dentro de un commit de otra cosa es un problema de atomicidad (`change-hygiene`), no de diseño.
