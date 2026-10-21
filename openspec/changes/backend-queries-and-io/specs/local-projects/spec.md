# Spec Delta

## ADDED Requirements

### Requirement: La sincronización solo descarga PRs con cabeza nueva
Antes de pedir el diff de ninguna PR abierta, la sincronización SHALL averiguar con una sola
consulta qué cabezas (`head_sha`) de la lista ya están registradas como change `pr` del proyecto.
Solo SHALL descargar el diff, ingerir y arrancar la review de las PRs cuya cabeza no esté
registrada. Las ya registradas SHALL contar en `synced` y no en `created`.

#### Scenario: Ciclo de PRs sin cambios
- **WHEN** un proyecto local tiene 30 PRs abiertas cuyas cabezas ya están registradas como changes
  `pr` y corre una sincronización
- **THEN** no se pide ningún diff a `gh`, no se arranca ningún workflow y la respuesta es
  `synced` 30 y `created` 0

#### Scenario: PR con push nuevo
- **WHEN** una PR registrada con `head_sha=aaa` pasa a tener la cabeza `bbb` y corre una
  sincronización
- **THEN** se descarga el diff de esa PR y se ingesta `bbb` como change nuevo

#### Scenario: Mezcla de PRs nuevas y registradas
- **WHEN** hay tres PRs abiertas y solo una tiene la cabeza sin registrar
- **THEN** se pide a `gh` un único diff y la respuesta es `synced` 3 y `created` 1
