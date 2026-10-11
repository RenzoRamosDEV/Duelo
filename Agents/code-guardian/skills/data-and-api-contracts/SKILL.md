---
name: data-and-api-contracts
description: Migraciones de base de datos, deriva entre modelos y esquema, transacciones e idempotencia, y compatibilidad del contrato de la API (OpenAPI, códigos de estado, esquemas).
paths:
  - "*alembic/*"
  - "*migrations/*"
  - "*.sql"
  - "*models.py"
  - "*repositor*"
  - "*/api/*"
  - "*router*"
  - "*schemas*"
  - "*openapi*"
---

Dos superficies donde un error se paga caro y tarde: el esquema de datos y el contrato público.

**Migraciones**
- Cada cambio de modelo trae su migración y viceversa; índices, `UNIQUE` y constraints cuentan como parte del modelo.
- Reversibilidad: `downgrade` implementado. Una migración irreversible sin plan es bloqueante.
- Seguridad de los datos: `NOT NULL` sin valor por defecto sobre una tabla con datos, borrar o renombrar una columna en uso, cambiar tipos con pérdida, `DROP` sin copia. Pasos seguros: añadir nullable, rellenar, imponer; o expandir y contraer en dos despliegues.
- Bloqueos: creación de índices sin `CONCURRENTLY` y `ALTER TABLE` pesados sobre tablas grandes.
- Cadena de revisiones única, sin ramas.
- Longitudes de columna y constantes de validación del dominio coinciden.

**Persistencia, transacciones e idempotencia**
- Lo que debe ser atómico va en una transacción: la fila y su evento de salida se escriben juntos o no se escribe nada.
- Idempotencia por clave natural con `UNIQUE` más `INSERT … ON CONFLICT`; no con «consultar y luego insertar». Reintentar debe ser seguro.
- Una sesión compartida entre repositorios que abren su propia transacción falla de formas sutiles.
- Texto saneado (NUL) y dentro de los límites antes de llegar a la base.
- Consulta nueva: ¿índice?, ¿paginación?, ¿orden determinista?

**Contrato de la API**
- Incompatibles hacia atrás: quitar o renombrar un campo, endurecer una validación, cambiar un tipo, un código de estado o una cabecera, hacer obligatorio un campo opcional. Con clientes existentes es importante salvo versionado o migración documentada.
- Compatibles: campos opcionales nuevos, respuestas nuevas documentadas.
- Todos los códigos de estado reales están documentados; un handler que devuelve un estado que el contrato no declara es un bug de contrato.
- Mapa de errores coherente (401 sin credencial, 404 inexistente, 422 inválido, 503 dependencia caída) y cuerpos de error sin detalles internos.
- Los límites del esquema salen de las constantes del dominio, no se duplican como números sueltos.
- Si hay un snapshot del contrato o un cliente generado, el diff lo actualiza junto con el cambio.
- Reenviar la misma petición devuelve el mismo recurso y no duplica efectos.

**Cómo confirmarlo.** Si puedes leer el repositorio, contrasta el modelo con la migración y el handler con el snapshot del contrato. Si solo tienes el diff, reporta la deriva que el diff muestra (migración sin su modelo, handler con un estado nuevo sin documentar) y deja como duda lo que exige ver otros ficheros.
