# Spec Delta

## MODIFIED Requirements

### Requirement: La selección gobierna las reviews
La ingesta de commits y PRs y el reintento de reviews SHALL arrancar únicamente a los agentes de la selección efectiva del proyecto. El estado de un change SHALL calcularse con el número de agentes de la selección con la que arrancó su run actual como reviews esperadas (ver «Reviews esperadas fijadas por run»), de modo que un change revisado por el único agente elegido queda «completado». Cambiar la selección SHALL NOT borrar ni relanzar reviews existentes, ni alterar las ejecuciones ya arrancadas.

#### Scenario: Commit con un solo agente elegido
- **WHEN** el proyecto tiene `["codex"]` y se ingiere un commit
- **THEN** el workflow arranca con `agent_names` igual a `["codex"]` y, al registrarse la review de Codex, el change queda «completado»

#### Scenario: Selección con ambos
- **WHEN** el proyecto no tiene selección y se ingiere un commit
- **THEN** el workflow arranca con todos los agentes disponibles, como antes

#### Scenario: Cambio de selección con reviews previas
- **WHEN** un change ya tiene reviews de Claude y Codex y el proyecto pasa a `["claude"]`
- **THEN** ambas reviews siguen visibles y el change sigue «completado»

## ADDED Requirements

### Requirement: Reviews esperadas fijadas por run
Al crear un change y al arrancar cada reintento, el sistema SHALL guardar con el change el número
de agentes de la selección efectiva en ese momento. El estado del change en el canal, en el
detalle y al decidir un reintento SHALL calcularse con ese número; cambiar después la selección NO
SHALL alterarlo. Un change sin número guardado SHALL calcularse con la selección actual del
proyecto o, sin ella, con los agentes configurados, como hasta ahora.

#### Scenario: Cambio de agentes tras revisar
- **WHEN** un proyecto con 1 agente tiene un change `completed` con 1 review en el run 1 y 1 agente
  esperado guardado, y la selección del proyecto pasa a 2 agentes
- **THEN** el change sigue `completed` en el canal (también al filtrar por estado) y en el detalle

#### Scenario: El reintento fija la nueva selección
- **WHEN** con la selección ya en 2 agentes se reintenta un change fallido de ese proyecto
- **THEN** el change pasa al run siguiente con 2 agentes esperados guardados

#### Scenario: Change antiguo sin número guardado
- **WHEN** un change no tiene número de agentes esperados guardado y se lista el canal
- **THEN** su estado se calcula como antes del cambio: con la selección actual del proyecto o, sin
  ella, con los agentes configurados

### Requirement: Relleno de las reviews esperadas de los changes existentes
La migración que introduce el número guardado SHALL rellenarlo, para cada change existente, con el
número de agentes distintos que tienen review en su run actual, y SHALL dejarlo vacío si ese run
no tiene ninguna. Deshacer la migración SHALL eliminar el dato sin tocar changes ni reviews.

#### Scenario: Change con reviews de dos agentes
- **WHEN** antes de migrar un change en el run 2 tiene reviews de `claude` y `codex` en el run 2 y
  de `claude` en el run 1
- **THEN** tras migrar su número guardado es 2

#### Scenario: Change sin reviews en su run
- **WHEN** antes de migrar un change no tiene reviews en su run actual
- **THEN** tras migrar no tiene número guardado y su estado se calcula como antes
