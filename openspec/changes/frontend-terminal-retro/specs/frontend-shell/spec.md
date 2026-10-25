# Spec Delta

## ADDED Requirements

### Requirement: Estética de terminal retro legible
La interfaz SHALL usar un único tema de terminal retro definido como tokens CSS en un solo fichero:
fondo negro, verde para el texto principal, verde apagado para texto secundario y bordes, verde
oscuro para superficies y un único color de alerta (ámbar) para errores y fallos. El texto de
lectura (párrafos, formularios, tablas, listas) SHALL ir en una sans-serif legible a 16 px con
interlineado 1,5; la monospace SHALL reservarse a títulos, prompts «$», badges, SHA, rutas y código.
Los detalles retro (cursor parpadeante en el título de página, prefijo «>» en la navegación activa,
scanlines con opacidad inferior a 0,05) SHALL ser sutiles, SHALL poder apagarse desde Ajustes y
SHALL desactivarse con `prefers-reduced-motion`. Nada SHALL parpadear salvo el cursor.

#### Scenario: Texto de lectura
- **WHEN** se muestra un párrafo, un formulario o una tabla
- **THEN** su fuente es la sans-serif del cuerpo, no la monospace

#### Scenario: Movimiento reducido
- **WHEN** el usuario prefiere movimiento reducido
- **THEN** el cursor no parpadea y no se pintan scanlines

#### Scenario: Apagar los efectos
- **WHEN** el usuario desactiva «Efectos de pantalla» en Ajustes
- **THEN** desaparecen las scanlines y el parpadeo, y la elección se conserva entre visitas

### Requirement: Secciones de Ajustes
Ajustes SHALL organizarse en cajas con título (Pantalla, General, Proyectos vigilados, Diagnóstico);
Pantalla contiene el interruptor de efectos retro, y las acciones destructivas («Quitar proyecto»)
se muestran en el color de alerta y con confirmación.

#### Scenario: Apagar los efectos desde Ajustes
- **WHEN** el usuario desactiva «Efectos de pantalla» en la caja Pantalla
- **THEN** la interfaz deja de pintar scanlines y el cursor no parpadea

#### Scenario: Quitar un proyecto
- **WHEN** el usuario pulsa «Quitar proyecto»
- **THEN** el botón va en el color de alerta y se abre una confirmación antes de quitarlo

### Requirement: Indicador de carga en texto
Toda carga o acción en curso SHALL mostrarse con una etiqueta de texto visible («Cargando cambios…»,
«Comprobando dependencias…», etc.) acompañada de un cursor de bloque; en los botones ocupados la
etiqueta sustituye al texto del botón, que queda deshabilitado. El indicador SHALL anunciarse como
región de estado y SHALL NOT cambiar la maquetación al aparecer. El sondeo silencioso SHALL NOT
mostrar indicador.

#### Scenario: Carga de una página
- **WHEN** el canal, el detalle, las estadísticas, los proyectos o el diagnóstico están cargando
- **THEN** se muestra su etiqueta de texto con el cursor

#### Scenario: Acción en curso en un botón
- **WHEN** el usuario envía «Reintentar review», «Añadir», «Quitar proyecto» o «Sincronizar PRs», o
  pulsa «Cargar más» y la petición está en curso
- **THEN** el botón queda deshabilitado y muestra la etiqueta de la acción en curso

#### Scenario: Sondeo silencioso
- **WHEN** una página se refresca sola por el sondeo
- **THEN** no aparece ningún indicador y los datos anteriores siguen visibles

### Requirement: Diseño adaptable
La interfaz SHALL diseñarse mobile first con puntos de corte en 480, 768, 1024 y 1280 px y SHALL NOT
producir scroll horizontal de página en ningún ancho a partir de 320 px. Las tablas SHALL pasar en
móvil a tarjetas (una por fila, con el nombre de cada columna) o a scroll horizontal dentro de su
propia caja. Los formularios SHALL ir a una columna en móvil y los controles interactivos SHALL
tener al menos 44 px de alto.

#### Scenario: Estadísticas en móvil
- **WHEN** el ancho es de 375 px
- **THEN** cada agente se muestra como una tarjeta con sus valores etiquetados y la página no se
  desplaza horizontalmente

#### Scenario: Diff en móvil
- **WHEN** el ancho es de 375 px y un archivo tiene líneas largas
- **THEN** el diff se desplaza dentro de su caja y el resto de la página no

#### Scenario: Altura de controles
- **WHEN** se muestra cualquier botón, campo o pestaña
- **THEN** su alto es de al menos 44 px

## MODIFIED Requirements

### Requirement: Estado de review en curso
Una review en curso SHALL mostrarse con la etiqueta «<Agente> está revisando…» y un cursor
parpadeante; una completada o fallida SHALL mostrarse sin animación y con indicación textual del
estado.

#### Scenario: Review en curso
- **WHEN** una review está en estado "en curso"
- **THEN** se muestra «<Agente> está revisando…» con el cursor

#### Scenario: Movimiento reducido
- **WHEN** el usuario tiene `prefers-reduced-motion: reduce`
- **THEN** el cursor queda fijo y las transiciones se desactivan

### Requirement: Contraste accesible
El texto y los controles interactivos SHALL cumplir contraste WCAG AA (4.5:1): el texto secundario
sobre el fondo y sobre las superficies, el color de alerta sobre el fondo y sobre su fondo tintado,
el botón principal (normal y con el cursor encima), el enlace activo de la navegación y el texto
sobre los fondos del diff.

#### Scenario: Texto secundario
- **WHEN** se muestra texto secundario sobre el fondo o sobre una superficie
- **THEN** su ratio de contraste es al menos 4.5:1

#### Scenario: Estados sobre su fondo
- **WHEN** se muestra un error o un fallo sobre su fondo tintado
- **THEN** su ratio de contraste es al menos 4.5:1

### Requirement: Agentes pendientes de un change
El detalle de un change con estado agregado `pending` o `running` SHALL mostrar una línea
«<Agente> está revisando…» con cursor por cada agente esperado (`agent_names` del diagnóstico) que
aún no tiene review del run actual, y SHALL retirarla cuando esa review llega. Un agente con review
de un run anterior SHALL seguir contando como pendiente en el run actual. Mientras los agentes
esperados no se conozcan, SHALL mostrarse una única línea «Esperando a los agentes…». Un change
`completed`, `failed` o `partial_failed` no SHALL mostrar agentes pendientes. En la lista del
proyecto el agente pendiente se muestra como check en espera.

#### Scenario: Ninguna review todavía
- **WHEN** un change `pending` tiene agentes esperados `agent_1` y `agent_2` y ninguna review
- **THEN** su detalle muestra «Agent_1 está revisando…» y «Agent_2 está revisando…»

#### Scenario: Review parcial
- **WHEN** `agent_1` ya entregó su review y `agent_2` no
- **THEN** solo queda la línea de `agent_2`

#### Scenario: Todos entregaron
- **WHEN** el change pasa a `completed`
- **THEN** no queda ninguna línea de agente pendiente

#### Scenario: Reintento
- **WHEN** un change tiene reviews del run 1 y está `pending` en el run 2
- **THEN** ambos agentes figuran como pendientes del run 2

#### Scenario: Agentes desconocidos
- **WHEN** el diagnóstico aún no ha informado de los agentes y el change está `pending`
- **THEN** se muestra una única línea «Esperando a los agentes…»

### Requirement: Reviews como mensajes
Cada review SHALL mostrarse como un bloque con la etiqueta monospace del agente (`[claude]`,
`[codex]`, o el nombre tal cual para otros), estado, resumen, hallazgos con una marca por severidad
(ámbar para `critical`, `bug` y `high`; verde apagado con texto de severidad para el resto, siempre
con la etiqueta en texto) y, como metadatos, el run, la duración y la nota.

#### Scenario: Severidad con color
- **WHEN** una review tiene hallazgos `bug`, `risk` y `nit`
- **THEN** cada uno muestra su etiqueta «Bug», «Riesgo» y «Detalle», y solo el primero va en ámbar

#### Scenario: Agente sin respuesta
- **WHEN** un agente esperado aún no ha entregado su review
- **THEN** aparece «<Agente> está revisando…» con el cursor

### Requirement: Estados vacíos y de error con ilustración
Los estados vacíos, de error y de página no encontrada SHALL mostrar un bloque de prompt («$ ») con
un título, una explicación y la acción principal; mientras carga el canal SHALL verse una estructura
de esqueleto oculta a la tecnología asistiva junto al texto de carga.

#### Scenario: Página no encontrada
- **WHEN** se abre una dirección que no existe
- **THEN** se ve el título «No encontrado» como encabezado de la página y un botón «Volver al
  inicio»

## REMOVED Requirements

### Requirement: Ajustes en cajas
**Reason**: desaparece la caja Apariencia con el selector de tema.
**Migration**: «Secciones de Ajustes».

### Requirement: Temas claro y oscuro
**Reason**: la estética de terminal retro es un único tema.
**Migration**: «Estética de terminal retro legible»; la preferencia guardada `duelo-theme` se ignora.

### Requirement: Indicador de carga con orbes
**Reason**: se elimina `thinking-orbs`.
**Migration**: «Indicador de carga en texto».

### Requirement: Brillo de borde en lo que está en curso
**Reason**: se elimina `border-beam`; el estado en curso se comunica con icono, texto y cursor.
**Migration**: «Estado de review en curso» y «Agentes pendientes de un change».

### Requirement: Selector de tema con indicador líquido
**Reason**: no hay selector de tema ni `liquid-gooey`.
**Migration**: ninguna.

### Requirement: Botones con anillo de metal en las acciones clave
**Reason**: se elimina `metal-fx`; las acciones clave son botones primarios normales.
**Migration**: ninguna.

### Requirement: Héroe de los estados vacíos
**Reason**: se eliminan `img-fx` y `three`.
**Migration**: «Estados vacíos y de error con ilustración» (bloque de prompt).

### Requirement: Avatares de agente con logo
**Reason**: los agentes se identifican con una etiqueta de texto monospace.
**Migration**: «Reviews como mensajes» y `project-browser` («Check por agente en cada fila»).

### Requirement: Logo de la aplicación según el tema
**Reason**: la marca pasa a ser el texto «$ duelo_» en monospace; los iconos de la PWA y los favicons se conservan.
**Migration**: ninguna.

### Requirement: El logo se muestra completo
**Reason**: no hay logo en la navegación; los favicons e iconos de la PWA se conservan tal cual.
**Migration**: ninguna.
