# agent-selection Specification

## Purpose
TBD - created by archiving change agent-selection. Update Purpose after archive.

## Requirements

### Requirement: Selección de agentes por proyecto
Cada proyecto SHALL tener una selección de agentes entre los disponibles (los de `AGENT_NAMES`). Sin selección guardada SHALL evaluarlo todos los disponibles. `GET /projects` SHALL devolver en cada proyecto `agents`: la selección efectiva, en el orden de `AGENT_NAMES`. Si la selección guardada no contiene ningún agente disponible SHALL aplicarse todos los disponibles.

#### Scenario: Proyecto sin selección
- **WHEN** un proyecto nunca tuvo selección y `AGENT_NAMES` es `claude,codex`
- **THEN** `GET /projects` devuelve `agents` igual a `["claude","codex"]`

#### Scenario: Selección guardada
- **WHEN** un proyecto tiene guardado `["codex"]`
- **THEN** `GET /projects` devuelve `agents` igual a `["codex"]`

#### Scenario: Selección con un agente que ya no existe
- **WHEN** un proyecto tiene guardado `["gemini"]` y `AGENT_NAMES` es `claude,codex`
- **THEN** `agents` es `["claude","codex"]`

### Requirement: Cambiar la selección
`PUT /projects/{slug}/agents` con `{"agents": [...]}` SHALL guardar la selección y responder 200 con el proyecto actualizado. SHALL exigir `X-Ingest-Token` válido (401 si falta o es incorrecta), contar contra el límite de peticiones y no depender de `LOCAL_PROJECTS_ENABLED`. SHALL responder 422 sin guardar si la lista está vacía, repite un nombre o contiene uno no disponible, y 404 si el proyecto no existe.

#### Scenario: Elegir solo Claude
- **WHEN** se llama con `{"agents": ["claude"]}` y token válido
- **THEN** la respuesta es 200 con `agents` igual a `["claude"]` y un `GET /projects` posterior lo devuelve igual

#### Scenario: Lista vacía
- **WHEN** se llama con `{"agents": []}`
- **THEN** la respuesta es 422 y la selección anterior no cambia

#### Scenario: Agente no disponible
- **WHEN** se llama con `{"agents": ["gemini"]}`
- **THEN** la respuesta es 422 y no se guarda nada

#### Scenario: Sin token
- **WHEN** se llama sin `X-Ingest-Token`
- **THEN** la respuesta es 401 y no se guarda nada

#### Scenario: Proyecto desconocido
- **WHEN** el slug no existe
- **THEN** la respuesta es 404

### Requirement: La selección gobierna las reviews
La ingesta de commits y PRs y el reintento de reviews SHALL arrancar únicamente a los agentes de la selección efectiva del proyecto. El estado de un change SHALL calcularse con el número de agentes de esa selección como reviews esperadas, de modo que un change revisado por el único agente elegido queda «completado». Cambiar la selección SHALL NOT borrar ni relanzar reviews existentes, ni alterar las ejecuciones ya arrancadas.

#### Scenario: Commit con un solo agente elegido
- **WHEN** el proyecto tiene `["codex"]` y se ingiere un commit
- **THEN** el workflow arranca con `agent_names` igual a `["codex"]` y, al registrarse la review de Codex, el change queda «completado»

#### Scenario: Selección con ambos
- **WHEN** el proyecto no tiene selección y se ingiere un commit
- **THEN** el workflow arranca con todos los agentes disponibles, como antes

#### Scenario: Cambio de selección con reviews previas
- **WHEN** un change ya tiene reviews de Claude y Codex y el proyecto pasa a `["claude"]`
- **THEN** ambas reviews siguen visibles y el change sigue «completado»

### Requirement: Control de la selección en Ajustes
La pantalla de Ajustes SHALL mostrar, por cada proyecto, una casilla por agente disponible con la selección efectiva marcada, y SHALL permitir guardar los cambios con el token de ingesta. SHALL NOT permitir guardar con ninguna casilla marcada. SHALL indicar que el cambio aplica a los commits que lleguen después y mostrar el error del servidor si falla.

#### Scenario: Marcar solo Codex
- **WHEN** el usuario desmarca Claude, deja Codex y pulsa Guardar con token
- **THEN** el front llama a `PUT /projects/{slug}/agents` con `["codex"]` y muestra la selección guardada

#### Scenario: Ninguna casilla
- **WHEN** el usuario desmarca todos los agentes
- **THEN** el botón Guardar queda deshabilitado

#### Scenario: Token no válido
- **WHEN** el servidor responde 401 al guardar
- **THEN** se muestra «Token de ingesta no válido.» y la selección mostrada vuelve a la guardada
