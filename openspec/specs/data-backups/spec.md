# data-backups Specification

## Purpose
Copia de seguridad y restauración de la base de datos local de Duelo (reviews, votos,
estadísticas y el estado de Temporal), comprimida, con retención y programable sin servicios
nuevos.

## Requirements

### Requirement: Copia completa comprimida
Una receta `just backup` SHALL volcar todas las bases del servidor Postgres de desarrollo
(`duelo`, `temporal`, `temporal_visibility`) en un único fichero comprimido con nombre fechado
dentro de la carpeta de copias, y SHALL fallar con mensaje claro si el contenedor de Postgres no
está en marcha.

#### Scenario: Copia con la infraestructura arriba
- **WHEN** se ejecuta `just backup` con Postgres en marcha
- **THEN** aparece `backups/duelo-<fecha-hora>.sql.zst` y descomprimido contiene las tres bases

#### Scenario: Postgres parado
- **WHEN** se ejecuta `just backup` sin el contenedor de Postgres
- **THEN** la receta termina con error diciendo que la infraestructura no está arriba

### Requirement: Retención
`just backup` SHALL conservar solo las últimas N copias de la carpeta (N configurable, 14 por
defecto) y borrar las más antiguas.

#### Scenario: Más copias que el límite
- **WHEN** la carpeta tiene 14 copias y se hace una más con el límite por defecto
- **THEN** quedan 14, sin la más antigua

### Requirement: Restauración
Una receta `just restore <fichero>` SHALL cargar una copia en el servidor Postgres de desarrollo
y SHALL negarse a hacerlo si la base `duelo` ya tiene datos, para no mezclar; la documentación
SHALL explicar cómo partir de un volumen vacío.

#### Scenario: Restaurar en un volumen vacío
- **WHEN** se levanta Postgres con un volumen nuevo y se ejecuta `just restore backups/x.sql.zst`
- **THEN** las reviews, votos y workflows de la copia están disponibles en la API y en Temporal

#### Scenario: Restaurar sobre datos existentes
- **WHEN** la base `duelo` ya contiene changes
- **THEN** la receta termina con error sin modificar nada

### Requirement: Programación documentada
La documentación SHALL incluir cómo ejecutar la copia a diario (cron o timer de systemd de
usuario) y cómo dejarla fuera de la máquina (carpeta sincronizada o `rclone` a un bucket), y la
carpeta de copias SHALL estar excluida del control de versiones.

#### Scenario: Carpeta ignorada
- **WHEN** existen copias en `backups/`
- **THEN** `git status` no las muestra
