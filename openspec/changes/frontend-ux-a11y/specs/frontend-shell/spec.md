# Spec Delta

## ADDED Requirements

### Requirement: Errores de formulario ligados a su campo
En el diálogo de añadir proyecto, en el formulario de reintento de review y en el diálogo de quitar
proyecto, cuando un error corresponde a un campo, ese input SHALL llevar `aria-invalid="true"`, su
`aria-describedby` SHALL contener el id de su texto de ayuda (si lo tiene) y el id del mensaje de
error, y el foco SHALL volver a ese input al mostrarse el error. Sin error, ningún input SHALL
llevar `aria-invalid`. Los textos de error SHALL ser los de hoy.

#### Scenario: Token rechazado al añadir proyecto
- **GIVEN** el diálogo de añadir proyecto con un token incorrecto
- **WHEN** la API responde 401
- **THEN** el input del token tiene `aria-invalid="true"`, su `aria-describedby` incluye el id del
  mensaje de error y tiene el foco

#### Scenario: Ruta relativa
- **WHEN** el usuario escribe una ruta que no es absoluta y pulsa «Añadir»
- **THEN** el input de la ruta tiene `aria-invalid="true"`, su `aria-describedby` incluye el id del
  aviso sobre los hooks y el id del mensaje de error, tiene el foco y no se envía ninguna petición

#### Scenario: Reintento sin token
- **WHEN** el usuario pulsa «Reintentar review» con el token vacío
- **THEN** el input del token tiene `aria-invalid="true"`, describe el mensaje de error y tiene el
  foco

#### Scenario: Error que no es de un campo
- **WHEN** la API responde 503 a un reintento
- **THEN** se muestra «El orquestador no está disponible. Inténtalo de nuevo en unos minutos.» y
  ningún input lleva `aria-invalid`

#### Scenario: Sin error
- **WHEN** el formulario se abre o el error desaparece al volver a enviar
- **THEN** ningún input lleva `aria-invalid` ni describe un mensaje de error

### Requirement: Campo al que corresponde cada error de formulario
Un error SHALL corresponder al campo del token cuando falta el token o la API responde 401, y al
campo de la ruta cuando la ruta no es absoluta o la API responde 409 o 422 al añadir un proyecto.
Los demás errores (función desactivada, proyecto inexistente, orquestador caído, fallo de red)
SHALL mostrarse sin marcar ningún campo.

#### Scenario: Proyecto ya añadido
- **WHEN** la API responde 409 al añadir un proyecto
- **THEN** el input de la ruta tiene `aria-invalid="true"` y el del token no

#### Scenario: Función desactivada
- **WHEN** la API responde 404 al añadir un proyecto
- **THEN** se muestra el aviso de hoy y ningún input lleva `aria-invalid`

### Requirement: Diálogos que no se cierran con una petición en vuelo
Mientras el diálogo de añadir proyecto o el de quitar proyecto espera la respuesta de la API, su
botón «Cancelar» SHALL estar deshabilitado y ni Escape ni el cierre nativo del diálogo SHALL
cerrarlo. Al llegar la respuesta, el diálogo SHALL volver a cerrarse con Escape y con «Cancelar»
como hoy.

#### Scenario: Escape durante el borrado
- **GIVEN** el diálogo de quitar proyecto con la petición DELETE en vuelo
- **WHEN** el usuario pulsa Escape o intenta pulsar «Cancelar»
- **THEN** el diálogo sigue abierto y «Cancelar» está deshabilitado hasta que llega la respuesta

#### Scenario: Escape durante el alta
- **GIVEN** el diálogo de añadir proyecto con la petición en vuelo
- **WHEN** el usuario pulsa Escape
- **THEN** el diálogo sigue abierto y «Cancelar» está deshabilitado

#### Scenario: Tras un fallo se puede cerrar
- **WHEN** la petición termina con un error
- **THEN** «Cancelar» vuelve a estar habilitado y Escape cierra el diálogo

### Requirement: Tabla de estadísticas en pantallas estrechas
La tabla de estadísticas por agente SHALL estar dentro de un contenedor con desplazamiento
horizontal propio, de modo que en una pantalla estrecha solo se desplace la tabla y no la página.
Por debajo de 760 px de ancho, las celdas SHALL reducir su padding horizontal a 8 px.

#### Scenario: Viewport de 360 px
- **WHEN** la página de estadísticas se ve con 360 px de ancho de viewport
- **THEN** la página no tiene scroll horizontal y la tabla se desplaza dentro de su contenedor

#### Scenario: Contenedor con scroll
- **WHEN** la página de estadísticas muestra la tabla
- **THEN** la tabla está dentro de un contenedor con desplazamiento horizontal

### Requirement: Jerarquía de encabezados del detalle
En el detalle de un change, el encabezado «Hallazgos» SHALL estar un nivel por debajo del de la
sección «Revisión de los agentes» que lo contiene (nivel 3), y los títulos de grupo de hallazgos
(archivo o «Sin archivo») SHALL estar en el nivel inmediatamente inferior (nivel 4). Su aspecto
visual SHALL ser el de hoy.

#### Scenario: Niveles del panel de hallazgos
- **WHEN** el detalle muestra hallazgos en `x.py` y sin archivo
- **THEN** «Hallazgos» es un encabezado de nivel 3 y «x.py» y «Sin archivo» son de nivel 4
