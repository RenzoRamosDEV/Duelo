## Purpose
Navegación de la interfaz en tres niveles (proyecto, lista de changes, detalle de un change), con una lista compacta que muestra de un vistazo el estado de cada commit o PR y la respuesta de cada agente.

## ADDED Requirements

### Requirement: Selector de proyectos como entrada
La ruta `/` SHALL mostrar los proyectos vigilados como una lista de tarjetas enlazadas a `/p/:slug`, cada una con el nombre `owner/repo`, etiquetas de GitHub, carpeta local y hooks instalados cuando existan, y la ruta local si la hay. SHALL ofrecer «Añadir proyecto» y NO SHALL redirigir al primer proyecto. Sin proyectos SHALL mostrar el estado vacío con la acción de añadir.

#### Scenario: Elegir proyecto
- **WHEN** el usuario abre `/` con dos proyectos
- **THEN** ve dos tarjetas y, al pulsar una, la ruta es `/p/:slug` de ese proyecto

#### Scenario: Sin redirección
- **WHEN** el usuario abre `/` con proyectos
- **THEN** permanece en `/` y no se abre ningún proyecto automáticamente

#### Scenario: Sin proyectos
- **WHEN** no hay ningún proyecto
- **THEN** se muestra el estado vacío con «Añadir proyecto»

### Requirement: Barra superior sin barra lateral
La interfaz NO SHALL tener barra lateral. La barra superior SHALL llevar la marca (enlace a `/`), un selector del proyecto actual (visible solo dentro de un proyecto o de un change; cambiarlo navega al proyecto elegido), enlaces a Estadísticas y Ajustes con el destino activo marcado, y el selector de tema. En pantallas estrechas los enlaces SHALL reducirse a iconos con nombre accesible, sin cajón ni botón «Menú». Todo SHALL ser operable con teclado.

#### Scenario: Cambiar de proyecto desde la barra
- **WHEN** el usuario está en un proyecto y elige otro en el selector de la barra
- **THEN** la ruta pasa a `/p/:slug` del elegido

#### Scenario: Fuera de un proyecto
- **WHEN** el usuario está en `/` o en Ajustes
- **THEN** la barra no muestra el selector de proyecto

#### Scenario: Pantalla estrecha
- **WHEN** el ancho es el de un móvil
- **THEN** Estadísticas y Ajustes se muestran como iconos con su nombre accesible y no existe el botón «Menú»

### Requirement: Lista compacta de changes del proyecto
La página `/p/:slug` SHALL listar los commits y PRs del proyecto en filas compactas de una línea (dos en pantalla estrecha): icono de estado de la review con texto alternativo, icono y etiqueta de tipo (Commit o PR), título, `#sha`, autor y antigüedad, y a la derecha los checks de los agentes. Toda la fila SHALL ser un enlace al detalle del change, operable con teclado. La lista NO SHALL mostrar el hilo de respuestas, insignias de resumen ni interruptor de densidad.

#### Scenario: Fila de un commit
- **WHEN** un proyecto tiene un commit `abc1234` de `ana` con la review completada
- **THEN** su fila muestra el título, `#abc1234`, «por ana», la antigüedad y el icono «Completada», y es un único enlace a su detalle

#### Scenario: Sin hilo en la lista
- **WHEN** se muestra la lista
- **THEN** no hay botón «Ver respuestas» ni respuestas de los agentes dentro de las filas

#### Scenario: Estado con texto alternativo
- **WHEN** un change tiene `review_status` `partial_failed`
- **THEN** su icono es una imagen con el texto «Fallo parcial»

### Requirement: Controles de la lista de changes
La página del proyecto SHALL ofrecer búsqueda por título, autor, SHA o rama, filtro por tipo (todo, PR, commit), pestañas de estado de la review y «Cargar más», y SHALL contar en la cabecera lo **cargado** por estado, con «+» cuando haya otra página. SHALL conservar la búsqueda, los filtros y lo cargado en cada refresco automático.

#### Scenario: Contadores de lo cargado
- **WHEN** hay tres changes cargados y hay otra página
- **THEN** la cabecera de la lista dice «3+ cambios» seguido del desglose por estado

#### Scenario: Filtrar por tipo
- **WHEN** el usuario elige «PRs»
- **THEN** solo se listan las PRs y el filtro queda con `aria-pressed="true"`

#### Scenario: Buscar
- **WHEN** el usuario escribe parte de un título
- **THEN** la lista muestra solo los changes que coinciden

### Requirement: Check por agente en cada fila
Cada fila SHALL mostrar un chip por agente esperado (los de `agent_names` del diagnóstico y los que ya tengan review; si no se conocen, solo los que tengan review) con el logo del agente (Claude y Codex; iniciales en otro caso) y su estado de la run actual: respondió (check), falló (aspa) o en espera (atenuado, sin check). Cada chip SHALL tener nombre accesible «Claude: completada», «Codex: fallida» o «Codex: en espera», y el estado SHALL comunicarse también con la forma y no solo con el color.

#### Scenario: Claude respondió y Codex no
- **WHEN** un change tiene la review de Claude completada y la de Codex pendiente
- **THEN** la fila muestra el logo de Claude con un check («Claude: completada») y el de Codex atenuado sin check («Codex: en espera»)

#### Scenario: Un agente falló
- **WHEN** la review de Codex está fallida
- **THEN** su chip muestra una aspa y se llama «Codex: fallida»

#### Scenario: Agente desconocido
- **WHEN** una review llega con el agente `agent_1`
- **THEN** su chip muestra las iniciales «A1» con su estado

#### Scenario: Run nueva
- **WHEN** un change tiene reviews completadas del run 1 y está `pending` en el run 2
- **THEN** ambos agentes figuran en espera

### Requirement: Commits revertidos y deshechos en amarillo en la lista
La fila de un commit con `commit_state` `discarded` o `reverted` SHALL pintarse en amarillo (fondo tintado y borde izquierdo ámbar con los tokens del tema, legible en oscuro y en claro) con un icono de «deshacer» y una etiqueta en texto en la propia fila («COMMIT DESHECHO» con «Ya no está en la rama», o «COMMIT REVERTIDO» con «Revertido por `<sha corto>`»). Sus checks de agentes SHALL mostrarse igual. Una PR no se marca nunca.

#### Scenario: Commit deshecho
- **WHEN** un commit llega con `commit_state = discarded`
- **THEN** su fila es amarilla y muestra «COMMIT DESHECHO» y «Ya no está en la rama»

#### Scenario: Commit revertido
- **WHEN** un commit llega con `commit_state = reverted` y se conoce quién lo revierte
- **THEN** su fila muestra «COMMIT REVERTIDO» y «Revertido por <sha corto>»

#### Scenario: Commit normal
- **WHEN** un commit es `active`
- **THEN** su fila no cambia de color

### Requirement: Recuento de commits deshechos y revertidos
La cabecera de la lista SHALL añadir «N deshechos» y «N revertidos» de los cargados cuando haya alguno, y esos commits SHALL contar como cambios normales en los contadores de review.

#### Scenario: Recuentos
- **WHEN** hay un commit deshecho y uno revertido entre los cargados
- **THEN** la cabecera dice «1 deshecho · 1 revertido» y los contadores de review no cambian

### Requirement: Detalle del change en página propia
Pulsar una fila SHALL navegar a `/p/:slug/changes/:id`, una página aparte que concentra la información completa del change: estado, run, autor y rama, aviso de commit deshecho o revertido, reviews por agente, hallazgos, archivos y diff, acciones (abrir en GitHub, copiar SHA y rama) y el reintento cuando proceda. Sus migas SHALL ser «Proyectos / `<proyecto>` / `<sha corto>`», enlazadas a `/` y a `/p/:slug`. Un change inexistente SHALL mostrar «Change no encontrado».

#### Scenario: Abrir un change
- **WHEN** el usuario pulsa la fila de un commit
- **THEN** la ruta es `/p/:slug/changes/:id` y se ven sus reviews, hallazgos y diff

#### Scenario: Volver
- **WHEN** el usuario pulsa el nombre del proyecto en las migas
- **THEN** vuelve a la lista de ese proyecto

#### Scenario: Change inexistente
- **WHEN** el id no existe
- **THEN** se muestra «Change no encontrado»
