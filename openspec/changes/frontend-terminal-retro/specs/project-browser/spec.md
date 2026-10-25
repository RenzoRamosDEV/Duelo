# Spec Delta

## ADDED Requirements

### Requirement: Barra lateral con menú en móvil
A partir de 1024 px la interfaz SHALL mostrar una barra lateral fija de fondo elevado con la marca
(enlace a `/`), los enlaces Proyectos, Estadísticas y Ajustes con el destino activo marcado con una
barra izquierda y fondo (no con una caja con borde), la lista de proyectos vigilados bajo una
etiqueta de sección (cada uno enlaza a `/p/:slug`, el actual marcado), «Añadir proyecto» y un pie
con el estado de la conexión con la API. Por
debajo de 1024 px la barra lateral SHALL ocultarse tras un botón «Menú» en la cabecera que la abre
como cajón con foco atrapado, cierre con Escape y al pulsar fuera, y que SHALL cerrarse al navegar.
Todo SHALL ser operable con teclado.

#### Scenario: Cambiar de proyecto desde la barra
- **WHEN** el usuario está en un proyecto y pulsa otro en la lista de la barra lateral
- **THEN** la ruta pasa a `/p/:slug` del elegido y ese proyecto queda marcado

#### Scenario: Pantalla estrecha
- **WHEN** el ancho es de 375 px
- **THEN** no hay barra lateral visible, la cabecera muestra «Menú» y al pulsarlo se abre el cajón
  con los mismos enlaces

#### Scenario: Cerrar el cajón
- **WHEN** el cajón está abierto y el usuario pulsa Escape o un enlace
- **THEN** el cajón se cierra y el foco vuelve al botón «Menú»

## MODIFIED Requirements

### Requirement: Check por agente en cada fila
Cada fila SHALL mostrar un chip por agente esperado (los de `agent_names` del diagnóstico y los que
ya tengan review; si no se conocen, solo los que tengan review) con la etiqueta de texto del agente
en monospace y su estado de la run actual: respondió (check), falló (aspa) o en espera (atenuado,
sin check). Cada chip SHALL tener nombre accesible «Claude: completada», «Codex: fallida» o «Codex:
en espera», y el estado SHALL comunicarse también con la forma y no solo con el color.

#### Scenario: Claude respondió y Codex no
- **WHEN** un change tiene la review de Claude completada y la de Codex pendiente
- **THEN** la fila muestra «claude ✓» («Claude: completada») y «codex» atenuado sin check («Codex:
  en espera»)

#### Scenario: Un agente falló
- **WHEN** la review de Codex está fallida
- **THEN** su chip muestra una aspa y se llama «Codex: fallida»

#### Scenario: Agente desconocido
- **WHEN** una review llega con el agente `agent_1`
- **THEN** su chip muestra la etiqueta «agent_1» con su estado

#### Scenario: Run nueva
- **WHEN** un change tiene reviews completadas del run 1 y está `pending` en el run 2
- **THEN** ambos agentes figuran en espera

### Requirement: Commits revertidos y deshechos en amarillo en la lista
La fila de un commit con `commit_state` `discarded` o `reverted` SHALL pintarse con el color de
alerta (borde izquierdo ámbar y fondo tintado con los tokens del tema) con un icono de «deshacer» y
una etiqueta en texto en la propia fila («COMMIT DESHECHO» con «Ya no está en la rama», o «COMMIT
REVERTIDO» con «Revertido por `<sha corto>`»). Sus checks de agentes SHALL mostrarse igual. Una PR
no se marca nunca.

#### Scenario: Commit deshecho
- **WHEN** un commit llega con `commit_state = discarded`
- **THEN** su fila lleva el borde ámbar y muestra «COMMIT DESHECHO» y «Ya no está en la rama»

#### Scenario: Commit revertido
- **WHEN** un commit llega con `commit_state = reverted` y se conoce quién lo revierte
- **THEN** su fila muestra «COMMIT REVERTIDO» y «Revertido por <sha corto>»

#### Scenario: Commit normal
- **WHEN** un commit es `active`
- **THEN** su fila no cambia de color

## REMOVED Requirements

### Requirement: Barra superior sin barra lateral
**Reason**: la navegación pasa a barra lateral en escritorio y cajón en móvil.
**Migration**: «Barra lateral con menú en móvil».
