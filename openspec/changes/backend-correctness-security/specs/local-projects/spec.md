# Spec Delta

## ADDED Requirements

### Requirement: Cuerpo del hook acotado y en UTF-8
El hook SHALL recortar el diff de cada commit a 200 000 caracteres, el mismo valor que el máximo
por defecto de la ingesta, y SHALL serializar el cuerpo como JSON en UTF-8 sin escapar los
caracteres no ASCII, de modo que un diff recortado de texto no ASCII quepa en el tamaño máximo del
cuerpo de la ingesta por defecto.

#### Scenario: Diff grande con tildes
- **WHEN** un commit tiene un diff de 300 000 caracteres, todos `ñ`, y el hook construye el cuerpo
- **THEN** el diff enviado tiene 200 000 caracteres y el cuerpo ocupa menos de 1 500 000 bytes

#### Scenario: Diff pequeño
- **WHEN** el diff tiene menos de 200 000 caracteres
- **THEN** se envía íntegro y el texto no ASCII viaja tal cual en UTF-8, sin secuencias `\uXXXX`

### Requirement: Fallos de envío del hook visibles
Cuando el envío de un commit falla, el hook SHALL escribir en su salida de error una sola línea
con el SHA corto (7 caracteres) y el motivo (el status HTTP o el tipo de la excepción), y SHALL
continuar con los demás commits. El código de salida del hook NO SHALL cambiar. La línea NUNCA
SHALL incluir el token ni el diff.

#### Scenario: La API responde con error
- **WHEN** el hook envía dos commits y la API responde 413 al primero y 202 al segundo
- **THEN** la salida de error tiene una sola línea con los 7 primeros caracteres del SHA del
  primero y `413`, el segundo commit se envía y el hook termina con código 0

#### Scenario: API inaccesible
- **WHEN** la conexión con la API falla
- **THEN** la línea lleva el SHA corto y el tipo de la excepción, y el hook termina con código 0

### Requirement: git sin configuración ejecutable del repositorio
Toda invocación de `git` que hacen la API o los workers sobre la carpeta de un proyecto (no el
hook, que corre dentro del propio git del usuario) SHALL ignorar la
configuración de sistema, desactivar `core.fsmonitor` y los hooks del repositorio, y NO SHALL
heredar variables que redirijan git a otro directorio (`GIT_DIR` y afines). La única excepción
SHALL ser la consulta del directorio de hooks al instalarlos o desinstalarlos, que necesita leer
`core.hooksPath` tal cual.

#### Scenario: Repositorio con fsmonitor malicioso
- **WHEN** el repositorio de un proyecto tiene `core.fsmonitor` apuntando a un script y el sistema
  inspecciona el repositorio, consulta su historial o escribe una nota
- **THEN** el script no se ejecuta

#### Scenario: GIT_DIR en el entorno
- **WHEN** el proceso de Duelo tiene `GIT_DIR` apuntando a otro repositorio
- **THEN** git opera sobre la carpeta del proyecto, no sobre ese otro repositorio

#### Scenario: Instalación con core.hooksPath dentro del repo
- **WHEN** el repositorio tiene `core.hooksPath` apuntando a una carpeta dentro de él y se da de
  alta el proyecto
- **THEN** los hooks se instalan en esa carpeta, como hasta ahora

## MODIFIED Requirements

### Requirement: El hook no sigue redirecciones
Al enviar a la API, el hook NUNCA SHALL seguir una redirección HTTP: una respuesta 3xx SHALL tratarse
como un fallo del envío (informado como cualquier otro, sin bloquear el commit ni el push) y el token
`X-Ingest-Token` SHALL enviarse únicamente al host de la URL del fichero de credenciales.

#### Scenario: La API redirige a otro host
- **WHEN** el servidor de la URL configurada responde 302 hacia otro host
- **THEN** el hook no hace ninguna segunda petición, el otro host no recibe nada y el comando de git
  termina con éxito
