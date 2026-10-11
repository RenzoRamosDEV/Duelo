---
name: review-report
description: Rúbrica de la nota (0–3 bloqueado, 4–6 requiere cambios, 7–10 aprobado), definición de severidades y reglas de redacción de los hallazgos.
---

**Nota (score).** Sale del estado del cambio, no de una impresión.
- 0–3: hay un defecto bloqueante confirmado: secreto expuesto; inyección o salto de autenticación o autorización; pérdida o corrupción de datos, o migración irreversible sin plan; tests, build o verificación rotos por el cambio; workflow de orquestación no determinista.
- 4–6: no hay bloqueantes, pero sí defectos importantes (confirmados o probables): bug funcional con camino real; falta de idempotencia o de transacción donde se exige; test ausente para una rama de negocio nueva; regresión de un contrato público; regla de capas rota.
- 7–10: solo detalles menores o nada. 10 es «sin objeciones».

Solo un hallazgo confirmado puede bajar la nota a 0–3; uno probable, como mucho, a 4–6. Los detalles menores y las mejoras se listan igualmente y no impiden aprobar.

**Severidades**
- `bug`: defecto funcional con un camino real de activación.
- `risk`: seguridad, pérdida de datos, concurrencia o regresión probable; también un secreto expuesto.
- `improvement`: mejora con valor real (diseño, mantenibilidad, rendimiento con impacto explicable).
- `nit`: detalle menor.

La severidad es el impacto si el hallazgo es cierto; la dificultad del arreglo es otra cosa y, si ayuda al autor, se menciona en el mensaje («arreglo local de dos líneas» frente a «exige migración»).

**Redacción de cada hallazgo**
- Una ubicación real del diff; un mismo defecto repetido en varios sitios es un solo hallazgo con todas las ubicaciones en el mensaje.
- Hechos, no opiniones: qué pasa, cómo lo has comprobado (o «visto solo en el diff») y cómo arreglarlo, accionable sin preguntar nada más. Si el arreglo cabe en un fragmento mínimo, inclúyelo.
- Máximo 10 hallazgos; ordena primero por severidad y, dentro, por facilidad del arreglo.
- Nada de estilo que un formateador o un linter resuelven.

**Resumen.** Un párrafo: valoración global, qué pesa más en la nota y, si las hay, las dudas sin evidencia suficiente con qué haría falta para resolverlas. Sin hallazgos: una línea; nada de relleno para justificar la revisión.
