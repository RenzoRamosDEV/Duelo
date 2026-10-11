---
name: frontend-review
description: Cambios de frontend: corrección de componentes y hooks, estados de carga/vacío/error, render seguro de contenido no confiable, accesibilidad, rendimiento de render, contrato con la API y tests centrados en el usuario.
paths:
  - "*.tsx"
  - "*.jsx"
  - "*.ts"
  - "*.vue"
  - "*.svelte"
  - "*.css"
  - "*.scss"
  - "*.html"
---

**Corrección en componentes y hooks**
- Reglas de hooks; dependencias de efectos incompletas o sobrantes; efectos que deberían ser valores derivados o manejadores; estado derivado duplicado; claves de lista inestables (índice como clave en listas que cambian).
- Condiciones de carrera al pedir datos (una respuesta vieja pisa a la nueva); limpieza de suscripciones, temporizadores y listeners; actualizar estado tras desmontar.
- Estados completos en cada vista que depende de datos: carga, vacío, error y éxito; fallo de red con mensaje útil y forma de reintentar.
- Rutas nuevas con estado de «no encontrado» y parámetros validados antes de usarse.

**Seguridad (contenido no confiable)**
- Texto que viene de terceros (comentarios, reviews, diffs, Markdown): nunca insertado como HTML crudo; Markdown renderizado con una librería que sanee; enlaces externos con `rel="noopener noreferrer"`.
- Tokens o secretos en el bundle (las variables públicas del build lo son), en almacenamiento local sin necesidad o en el código.

**Accesibilidad y UX**
- Elementos interactivos reales (`button`, `a`), nombre accesible, foco visible y orden de foco, contraste suficiente, movimiento reducido respetado, etiquetas en formularios, información que no dependa solo del color.

**Rendimiento**
- Renders innecesarios en listas largas; cálculos pesados en el render sin memoización justificada (no pidas memoización por defecto); imágenes sin dimensiones; dependencias voluminosas para algo pequeño.

**Contrato con la API**
- Los tipos del backend son la fuente de verdad: tipos escritos a mano que duplican los de la API, o datos de ejemplo que sobreviven al cableado real, son hallazgos.
- Los códigos de estado documentados tienen manejo en la interfaz.

**TypeScript**
- `any`, aserciones que silencian un error real, supresiones de tipos sin motivo, `!` sobre valores que pueden ser `undefined`. El formateador y el linter ya cubren el estilo: no lo repitas.

**Tests.** Un componente con lógica (estado, condiciones, eventos) tiene test centrado en lo que ve el usuario (roles y textos, no detalles de implementación); las utilidades puras, test unitario. No pidas snapshots por defecto.

**Cómo confirmarlo.** Si puedes leer el repositorio, abre el componente completo y sus consumidores. Si solo tienes el diff, limita los hallazgos a lo que el fragmento muestra (un efecto sin limpieza, HTML crudo con datos externos).
