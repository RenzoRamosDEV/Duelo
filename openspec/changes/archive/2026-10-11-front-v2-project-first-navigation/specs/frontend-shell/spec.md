## REMOVED Requirements

### Requirement: Navegación por canales
**Reason**: la barra lateral desaparece; el proyecto se elige en la entrada y en la barra superior.
**Migration**: capacidad `project-browser` (requisitos «Selector de proyectos como entrada» y «Barra superior sin barra lateral»).

### Requirement: Hilos de reviews desplegables
**Reason**: las respuestas de los agentes ya no se despliegan en la lista; viven en la página del change.
**Migration**: `project-browser` («Detalle del change en página propia»).

### Requirement: Navegación adaptable
**Reason**: sin barra lateral no hay cajón ni botón «Menú».
**Migration**: `project-browser` («Barra superior sin barra lateral», comportamiento en pantalla estrecha).

### Requirement: Vista compacta del canal
**Reason**: la lista es siempre compacta; se elimina el interruptor tarjetas/compacta.
**Migration**: `project-browser` («Lista compacta de changes del proyecto»).

### Requirement: Respuestas del canal con la API real
**Reason**: el listado ya no muestra «Ver respuestas»; el detalle completo se pide solo al abrir el change.
**Migration**: `project-browser` («Detalle del change en página propia»); la carga del detalle no cambia.

### Requirement: Marco de la aplicación
**Reason**: el marco pasa de barra lateral estilo Slack a barra superior con selector de proyecto.
**Migration**: `project-browser` («Barra superior sin barra lateral»).

### Requirement: Lista de changes estilo PR
**Reason**: se sustituye por la lista compacta de una línea con checks por agente.
**Migration**: `project-browser` («Lista compacta de changes del proyecto» y «Check por agente en cada fila»).

### Requirement: Resumen de reviews por change
**Reason**: las insignias de resumen se sustituyen por los checks por agente de cada fila.
**Migration**: `project-browser` («Check por agente en cada fila»); el estado agregado sigue visible como icono de la fila.

## MODIFIED Requirements

### Requirement: Contraste accesible
El texto y los controles interactivos SHALL cumplir contraste WCAG AA en el tema claro y en el
oscuro: el texto atenuado sobre cada superficie, los colores de estado sobre las superficies y
sobre sus fondos tintados, el botón principal (normal y con el cursor encima), el enlace activo
de la barra superior y el texto sobre los fondos del diff.

#### Scenario: Texto secundario
- **WHEN** se muestra texto atenuado sobre una superficie, en cualquiera de los dos temas
- **THEN** su ratio de contraste es al menos 4.5:1

#### Scenario: Estados sobre su fondo
- **WHEN** se muestra un estado (éxito, fallo, aviso) sobre su fondo tintado
- **THEN** su ratio de contraste es al menos 4.5:1 en ambos temas

### Requirement: Añadir un proyecto desde una carpeta local
La interfaz SHALL ofrecer un botón «Añadir proyecto» en el selector de proyectos de la entrada y en el estado vacío que
abre un diálogo accesible (`role` de diálogo, foco inicial en el campo de ruta, Tab sin salir del
diálogo, Escape lo cierra y el foco vuelve al botón que lo abrió). El diálogo SHALL pedir la ruta
absoluta del repositorio y el token de ingesta (campo de contraseña, solo en memoria) y SHALL
avisar de que se instalarán hooks de git `post-commit` y `pre-push` en ese repositorio, que se
pueden desinstalar. Una ruta que no sea absoluta SHALL rechazarse sin llamar a la API.

#### Scenario: Alta correcta
- **WHEN** el usuario escribe una ruta válida y el token y pulsa «Añadir»
- **THEN** el proyecto aparece en el selector de proyectos, se abre su página y el diálogo se cierra

#### Scenario: Función desactivada
- **WHEN** la API responde 404
- **THEN** el diálogo explica que la función está desactivada y que debe arrancarse con
  `LOCAL_PROJECTS_ENABLED=true`

#### Scenario: Proyecto ya añadido
- **WHEN** la API responde 409
- **THEN** el diálogo indica que el proyecto ya está añadido

#### Scenario: Ruta que no es un repositorio
- **WHEN** la API responde 422
- **THEN** el diálogo indica que la ruta no es un repositorio git válido

#### Scenario: Token no válido
- **WHEN** la API responde 401
- **THEN** el diálogo pide un token válido y el token guardado en memoria se olvida

#### Scenario: Ruta relativa
- **WHEN** el usuario escribe una ruta que no empieza por `/` ni por una unidad de disco
- **THEN** se muestra un error en el diálogo y no se envía ninguna petición

### Requirement: Auto-actualización
El selector de proyectos, la lista de changes del proyecto y el detalle de un change SHALL refrescarse solos cada pocos segundos
sin recargar la página, de modo que un commit o una PR nuevos aparezcan solos. El refresco SHALL
ser silencioso (sin estado de carga ni parpadeo), SHALL pausarse mientras la pestaña esté oculta y
refrescar al volver a mostrarla, SHALL conservar la búsqueda, los filtros y los elementos cargados
con «Cargar más» (sin perder ni duplicar ninguno) y SHALL NOT solapar peticiones. El detalle SHALL
seguir refrescándose solo mientras la review no haya terminado. La interfaz SHALL mostrar de forma
discreta cuándo se actualizó por última vez y avisar si el último refresco falló, conservando los
datos anteriores.

#### Scenario: Aparece un commit nuevo
- **WHEN** llega un commit nuevo mientras la lista del proyecto está abierta
- **THEN** aparece en la lista sin recargar y sin mostrar «Cargando»

#### Scenario: Se conservan búsqueda y páginas cargadas
- **WHEN** hay un texto de búsqueda y se han cargado más páginas y llega un refresco con un
  elemento nuevo
- **THEN** la búsqueda y todos los elementos cargados siguen visibles, cada uno una sola vez

#### Scenario: Pestaña oculta
- **WHEN** la pestaña está oculta
- **THEN** no se hacen peticiones, y al volver a mostrarse se refresca de inmediato

#### Scenario: Fallo al refrescar
- **WHEN** un refresco falla
- **THEN** los datos anteriores siguen visibles y se indica que la actualización falló

#### Scenario: Detalle terminado
- **WHEN** la review de un change ya terminó
- **THEN** el detalle deja de refrescarse

### Requirement: Agentes pendientes de un change
El detalle de un change con estado agregado `pending` o `running` SHALL
mostrar un orbe `working` con el nombre de cada agente esperado (`agent_names` del diagnóstico) que
aún no tiene review del run actual, y SHALL retirarlo cuando esa review llega. Un agente con review
de un run anterior SHALL seguir contando como pendiente en el run actual. Mientras los agentes
esperados no se conozcan, SHALL mostrarse un único orbe genérico en lugar de inventar nombres. Un
change `completed`, `failed` o `partial_failed` no SHALL mostrar agentes pendientes. En la lista
del proyecto el agente pendiente se muestra como check en espera, no como orbe.

#### Scenario: Ninguna review todavía
- **WHEN** un change `pending` tiene agentes esperados `agent_1` y `agent_2` y ninguna review
- **THEN** su detalle muestra dos orbes, «Agent_1 está revisando…» y «Agent_2 está revisando…»

#### Scenario: Review parcial
- **WHEN** `agent_1` ya entregó su review y `agent_2` no
- **THEN** solo queda el orbe de `agent_2`

#### Scenario: Todos entregaron
- **WHEN** el change pasa a `completed`
- **THEN** no queda ningún orbe de agente pendiente

#### Scenario: Reintento
- **WHEN** un change tiene reviews del run 1 y está `pending` en el run 2
- **THEN** ambos agentes figuran como pendientes del run 2

#### Scenario: Agentes desconocidos
- **WHEN** el diagnóstico aún no ha informado de los agentes y el change está `pending`
- **THEN** se muestra un único orbe «Esperando a los agentes…»

### Requirement: Commits deshechos y revertidos en el canal
La lista de changes del proyecto SHALL pintar la fila de un commit con `commit_state` `discarded` o `reverted` en amarillo, como define la capacidad `project-browser` («Commits revertidos y deshechos en amarillo en la lista»). El detalle SHALL mostrar su aviso («Aviso en el detalle de un commit deshecho o revertido»). Las reviews y los checks de los agentes SHALL seguir funcionando y un commit deshecho o revertido SHALL contar como un cambio normal en los contadores de revisión.

#### Scenario: Commit deshecho
- **WHEN** un commit llega con `commit_state = discarded`
- **THEN** su fila es amarilla, muestra «COMMIT DESHECHO» y «Ya no está en la rama»

#### Scenario: Commit revertido
- **WHEN** un commit llega con `commit_state = reverted`
- **THEN** su fila muestra «COMMIT REVERTIDO» y «Revertido por <sha corto>»

#### Scenario: Vista compacta
- **WHEN** la lista se muestra (siempre compacta, también en pantalla estrecha)
- **THEN** la etiqueta se muestra en la misma fila y la fila sigue siendo amarilla

#### Scenario: Commit normal
- **WHEN** un commit es `active`
- **THEN** su fila no cambia

#### Scenario: Recuentos de la cabecera
- **WHEN** hay un commit deshecho y uno revertido entre los cargados
- **THEN** la cabecera de la lista dice «1 deshecho · 1 revertido» y los contadores de revisión no cambian
