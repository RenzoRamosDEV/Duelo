## Purpose
Que cada review terminada tenga una copia fuera de la base de datos de Duelo: una nota de git en
el repositorio revisado, pegada al commit, que se empuja al remoto y sobrevive a la pérdida del
servidor local.

## ADDED Requirements

### Requirement: Nota por commit al terminar los agentes
Cuando todos los agentes de una run han terminado, el sistema SHALL escribir en el repositorio
local del proyecto una nota de git en la referencia `refs/notes/duelo` sobre el commit revisado,
con un documento JSON que contenga el proyecto, el sha, el tipo y el título del cambio, el
número de run y, por agente, estado, nota, resumen, hallazgos, duración y error. La nota NO
SHALL incluir la salida cruda del agente. Escribirla dos veces SHALL dejar una sola nota (la
última).

#### Scenario: Dos agentes completados
- **WHEN** Claude y Codex terminan la run 1 de un commit de un proyecto con carpeta local
- **THEN** `git notes --ref=duelo show <sha>` en esa carpeta devuelve un JSON con las dos
  reviews, sus notas y sus hallazgos

#### Scenario: Reintento de la run
- **WHEN** se reintenta el commit y termina la run 2
- **THEN** la nota del commit contiene las reviews de la run 2 y solo una nota existe para ese sha

### Requirement: Empuje de la referencia de notas
Tras escribir la nota, el sistema SHALL empujar `refs/notes/duelo` al remoto `origin` del
repositorio, salvo que el ajuste de empuje esté desactivado. El empuje SHALL usar la credencial
que el usuario ya tenga para ese remoto; el sistema NO SHALL pedir ni guardar credenciales.

#### Scenario: Remoto accesible
- **WHEN** el repositorio tiene `origin` y la credencial del usuario permite escribir
- **THEN** `refs/notes/duelo` del remoto contiene la nota del commit

#### Scenario: Empuje desactivado
- **WHEN** `REVIEW_NOTES_PUSH` es falso
- **THEN** la nota se escribe en local y no se ejecuta ningún empuje

### Requirement: La nota nunca bloquea la revisión
Si el proyecto no tiene carpeta local, el commit no existe en ella, `git` falla o el empuje
falla, el sistema SHALL registrar el motivo y dar por terminada la revisión igual: el estado de
las reviews y del change NO SHALL depender de la nota. Con `REVIEW_NOTES` desactivado el sistema
NO SHALL intentar escribirla.

#### Scenario: Proyecto sin carpeta local
- **WHEN** el proyecto se registró solo por slug, sin carpeta
- **THEN** las reviews quedan completadas, no se escribe nota y el resultado de la activity dice
  que se omitió por falta de carpeta

#### Scenario: Sin red
- **WHEN** la nota se escribe pero el empuje falla
- **THEN** la nota queda en local, el resultado dice que el empuje falló y el workflow termina
  completado

### Requirement: Compatibilidad con ejecuciones en vuelo
La activity de la nota SHALL añadirse al workflow bajo un marcador de parche, de forma que las
ejecuciones iniciadas con el código anterior se reproduzcan sin ella.

#### Scenario: Historia anterior al parche
- **WHEN** se reproduce una historia grabada antes de existir la nota
- **THEN** el replay termina sin error de no determinismo
