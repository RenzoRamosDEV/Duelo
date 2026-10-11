---
name: performance-review
description: Problemas de rendimiento reales: consultas N+1, filtros sin índice, transacciones largas, complejidad evitable, I/O en bucles, bloqueo del event loop, fugas de recursos y cachés sin límite. Siempre con el impacto esperado.
paths:
  - "*repositor*"
  - "*.sql"
  - "*quer*"
  - "*workflows/*"
  - "*activities*"
  - "*/api/*"
---

No propongas una optimización sin explicar su impacto esperado: de qué orden, bajo qué volumen y cómo lo estimas. Optimizar sin un coste demostrado es deuda. Importan los cuellos de botella reales, no los microajustes.

**Base de datos**
- N+1: una consulta por elemento dentro de un bucle. Se arregla con `IN`, `JOIN` o carga anticipada.
- Filtros u ordenaciones nuevas sobre columnas sin índice, si la tabla va a crecer.
- Cargar columnas enormes (diffs, blobs) cuando solo hace falta un id o un contador.
- Transacciones largas que mantienen una conexión abierta mientras se espera a la red o a un proceso externo; la transacción debe cubrir solo lo atómico.
- Sesiones que no se liberan; motores o pools creados por petición.

**Algoritmos y memoria**
- Complejidad cuadrática evitable (búsquedas en lista dentro de bucles, `in` sobre listas grandes).
- Cadenas concatenadas en bucle sobre datos grandes; copias innecesarias de datos de megabytes.
- Cargar un fichero o respuesta entera en memoria cuando se puede procesar en flujo.

**Async y concurrencia**
- Código síncrono pesado o bloqueante (sleep, CPU, cliente HTTP síncrono) dentro de una función asíncrona.
- Esperas secuenciales de operaciones independientes que podrían ir en paralelo; o lo contrario, paralelismo sin límite sobre miles de tareas.
- Reintentos sin backoff; esperas activas sin tope.

**Recursos**
- Clientes, conexiones o procesos hijo sin cerrar; tareas que no se cancelan; cachés sin límite ni expiración.

**Orquestación.** Si el proyecto usa un orquestador de workflows, por su historial viajan identificadores, no datos grandes; los payloads tienen límite.

**Cómo reportar.** Ubicación, por qué es lento, escala del problema («una consulta extra por elemento: 2 hoy, 500 con una página llena»), arreglo y cómo medirlo. Si el impacto es despreciable a la escala del proyecto, es `improvement` o no se reporta.
