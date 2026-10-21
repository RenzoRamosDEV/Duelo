# Spec Delta

## MODIFIED Requirements

### Requirement: Auto-actualización
El selector de proyectos, la lista de changes del proyecto y el detalle de un change SHALL refrescarse solos cada pocos segundos
sin recargar la página, de modo que un commit o una PR nuevos aparezcan solos. El refresco SHALL
ser silencioso (sin estado de carga ni parpadeo), SHALL pausarse mientras la pestaña esté oculta y
refrescar al volver a mostrarla, SHALL conservar la búsqueda, los filtros y los elementos cargados
con «Cargar más» (sin perder ni duplicar ninguno) y SHALL NOT solapar peticiones. El detalle SHALL
seguir refrescándose solo mientras la review no haya terminado. La interfaz SHALL mostrar de forma
discreta cuándo se actualizó por última vez y avisar si el último refresco falló, conservando los
datos anteriores. La lista de proyectos SHALL refrescarse cada 60 s y, además, justo después de
añadir un proyecto, quitarlo o cambiar sus agentes. La lista de changes SHALL refrescarse cada 5 s
mientras alguno de los elementos cargados esté `pending` o `running`, y cada 30 s cuando ninguno lo
esté. Un refresco que trae los mismos datos SHALL NOT volver a dibujar la página ni sus filas; solo
avanza la hora de la última actualización.

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

#### Scenario: Canal tranquilo
- **WHEN** un canal cuyos 50 elementos están todos `completed` sigue abierto 60 s con la pestaña
  visible
- **THEN** se hacen como mucho 2 peticiones al canal y ninguna fila se vuelve a dibujar mientras
  los datos no cambien

#### Scenario: Canal con una review en curso
- **WHEN** alguno de los elementos cargados del canal está `pending` o `running`
- **THEN** el canal se refresca cada 5 s, y pasa a cada 30 s en cuanto ninguno lo está

#### Scenario: Proyectos cada minuto
- **WHEN** una página cualquiera sigue abierta 60 s con la pestaña visible y sin tocar proyectos
- **THEN** la lista de proyectos se ha pedido como mucho una vez además de la carga inicial

#### Scenario: Proyecto añadido
- **WHEN** el usuario añade un proyecto, lo quita o cambia sus agentes
- **THEN** la lista de proyectos se vuelve a pedir enseguida, sin esperar al siguiente minuto

#### Scenario: Servidor colgado
- **WHEN** con el canal abierto el servidor acepta la conexión pero nunca responde y pasan 10 s
  desde el refresco
- **THEN** la petición se aborta, la página indica que la actualización falló y el siguiente
  sondeo se vuelve a intentar

### Requirement: Reintentar una review fallida
El detalle de un change SHALL ofrecer «Reintentar review» solo cuando su estado agregado es
`failed` o `partial_failed`. El token de ingesta SHALL escribirlo el usuario en un campo de
contraseña y SHALL conservarse únicamente en memoria de la pestaña: NO SHALL guardarse en
`localStorage`, en la URL ni en el código compilado. La acción SHALL tratar los resultados 202
(avisa del nuevo run y recarga el detalle), 401 (token no válido, lo olvida), 404, 409 (ya no se
puede reintentar, recarga el detalle), 503 (orquestador no disponible) y los fallos de red, y SHALL
admitir un solo envío a la vez. La recarga del detalle tras un 202 o un 409 SHALL ser silenciosa:
sin estado de carga y con el diff, las reviews y la posición de scroll visibles. El aviso del
reintento SHALL pertenecer al change en el que se hizo y NO SHALL mostrarse en otro.

#### Scenario: Visible solo con fallo
- **WHEN** el estado agregado del change es `completed`, `running` o `pending`
- **THEN** no hay botón de reintento

#### Scenario: Reintento aceptado
- **WHEN** el usuario escribe el token y pulsa «Reintentar review» y la API responde 202 con `run: 2`
- **THEN** se avisa "Reintento en marcha (run 2)" y se recarga el detalle

#### Scenario: Token no válido
- **WHEN** la API responde 401
- **THEN** se muestra "Token de ingesta no válido" y el campo vuelve a quedar vacío

#### Scenario: Conflicto
- **WHEN** la API responde 409
- **THEN** se avisa de que la review ya no se puede reintentar y se recarga el detalle

#### Scenario: Orquestador caído
- **WHEN** la API responde 503
- **THEN** se avisa de que el orquestador no está disponible y se puede volver a intentar

#### Scenario: El token no se persiste
- **WHEN** el usuario envía un reintento con un token
- **THEN** el token no aparece en `localStorage` ni en `sessionStorage`

#### Scenario: Recarga sin parpadeo
- **WHEN** la API acepta el reintento y el detalle se recarga
- **THEN** no aparece «Cargando change…» y el diff, las reviews y la posición de scroll siguen
  visibles mientras llegan los datos nuevos

#### Scenario: Navegar a otro change
- **WHEN** el detalle del change A muestra la nota «Reintento en marcha (run 2)» y se sigue el
  enlace al change B
- **THEN** el detalle de B no muestra esa nota

### Requirement: Indicador de carga con orbes
Toda carga o acción en curso de la interfaz SHALL mostrar un orbe de `thinking-orbs` de 20 px, con
el tema vigente (claro u oscuro), junto a una etiqueta de texto visible, sin cambiar la maquetación
(el orbe reserva su hueco). El estado del orbe SHALL depender de la actividad: cargas de listas,
páginas, proyectos, detalle y estadísticas `searching`; «Cargar más» y agentes revisando `working`;
reintento de una review `solving`; añadir, quitar o sincronizar proyectos y el diagnóstico
`connecting`. El indicador SHALL ser accesible (región de estado anunciada con la etiqueta; el orbe
es decorativo) y, con `prefers-reduced-motion`, SHALL sustituir el orbe animado por un «…» estático
sin montar ningún canvas. El orbe SHALL cargarse bajo demanda: mientras no ha llegado, el indicador
SHALL mostrar el mismo «…» estático con su etiqueta, en el mismo hueco.

#### Scenario: Carga de una página
- **WHEN** el canal, el detalle, las estadísticas, los proyectos o el diagnóstico están cargando
- **THEN** se muestra su etiqueta («Cargando cambios…», «Comprobando dependencias…», etc.) con un
  orbe del estado que le corresponde

#### Scenario: Acción en curso en un botón
- **WHEN** el usuario envía «Reintentar review», «Añadir», «Quitar proyecto» o «Sincronizar PRs», o
  pulsa «Cargar más» y la petición está en curso
- **THEN** el botón queda deshabilitado y su texto lleva un orbe en línea del estado de esa acción

#### Scenario: Movimiento reducido
- **WHEN** el usuario prefiere movimiento reducido
- **THEN** ninguna carga monta un canvas animado y todas conservan su etiqueta de texto

#### Scenario: Sondeo silencioso
- **WHEN** una página se refresca sola por el sondeo
- **THEN** no aparece ningún orbe y los datos anteriores siguen visibles

#### Scenario: Tema claro
- **WHEN** el tema vigente es el claro
- **THEN** el orbe se dibuja con la tinta oscura del tema claro

#### Scenario: Orbe aún no cargado
- **WHEN** se muestra un indicador de carga antes de que haya llegado el código del orbe
- **THEN** se ve el «…» estático con su etiqueta y, al llegar, el orbe ocupa ese mismo hueco

## ADDED Requirements

### Requirement: Plazo de las peticiones
Toda petición de la interfaz a la API SHALL abortarse si no termina en 10 s. Un plazo vencido SHALL
tratarse como un fallo de conexión con el mensaje «El servidor no respondió a tiempo.»: en una carga
se muestra con «Reintentar» y en un refresco se indica que la actualización falló.

#### Scenario: Carga sin respuesta
- **WHEN** se abre una página y el servidor no responde en 10 s
- **THEN** se muestra «El servidor no respondió a tiempo.» con el botón «Reintentar»

#### Scenario: Respuesta a tiempo
- **WHEN** el servidor responde antes de los 10 s
- **THEN** la página muestra los datos como hasta ahora

### Requirement: Respuesta no válida del servidor
Si la API responde con éxito (2xx) pero el cuerpo no es JSON, la interfaz SHALL mostrar «Respuesta
no válida del servidor.» como error de carga recuperable, en lugar de un error interno.

#### Scenario: Proxy que devuelve HTML
- **WHEN** `GET /projects` responde 200 con `<html>`
- **THEN** se muestra «Respuesta no válida del servidor.»

### Requirement: Peticiones canceladas al salir
Al salir de una página o cambiar su consulta (proyecto, filtros o búsqueda), la interfaz SHALL
cancelar la petición en curso de esa página. Una petición cancelada así SHALL NOT cambiar lo que se
muestra ni indicar que la actualización falló.

#### Scenario: Cambio de filtro con la petición en curso
- **WHEN** el canal está cargando y el usuario cambia el filtro de estado
- **THEN** la petición anterior se cancela, no aparece ningún error y se muestra el resultado del
  filtro nuevo

#### Scenario: Salir durante un refresco
- **WHEN** un refresco está en curso y el usuario navega a otra página
- **THEN** la petición se cancela y no aparece ningún aviso de fallo

### Requirement: Páginas cargadas bajo demanda
Estadísticas, Ajustes y el detalle de un change SHALL cargar su código al visitarlos por primera
vez. Mientras llega, el marco de la aplicación SHALL seguir visible y la zona de contenido SHALL
mostrar el indicador de carga con la etiqueta «Cargando…». El selector de proyectos y la lista de
changes SHALL estar disponibles sin esa espera.

#### Scenario: Primera visita a Estadísticas
- **WHEN** el usuario abre Estadísticas por primera vez en la sesión
- **THEN** la barra superior sigue visible, se muestra «Cargando…» y después la página

#### Scenario: Entrada sin espera de código
- **WHEN** el usuario abre el selector de proyectos o la lista de un proyecto
- **THEN** no se muestra «Cargando…» por código pendiente, solo los estados de carga de sus datos
