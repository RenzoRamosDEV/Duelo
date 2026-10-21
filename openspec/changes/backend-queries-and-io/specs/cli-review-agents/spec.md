# Spec Delta

## ADDED Requirements

### Requirement: Lectura de la salida con memoria acotada
Al ejecutar un programa externo (CLI de agente, git, `gh`), el sistema SHALL leer su salida
estándar y de error por bloques y, cuando cualquiera supere el límite de lectura, seguir leyendo y
descartar el resto hasta que el programa termine, devolviendo el resultado marcado como recortado
(`truncated`) con el código de salida real. La memoria retenida por llamada NO SHALL superar el
doble del límite más un bloque.

#### Scenario: Proceso desbocado
- **WHEN** el límite es 1000 bytes y un programa escribe 10 000 bytes en su salida estándar y
  termina
- **THEN** el resultado tiene como mucho 1000 bytes de salida estándar, está marcado como
  recortado y su código de salida es 0

#### Scenario: Salida diez veces mayor que el límite
- **WHEN** un programa emite 10 veces el límite por la salida estándar y por la de error
- **THEN** los bytes retenidos de cada una no superan el límite más un bloque

#### Scenario: Salida justo en el límite
- **WHEN** un programa escribe exactamente el límite y termina
- **THEN** el resultado no está marcado como recortado

### Requirement: Superar el límite no mata el programa
Superar el límite de lectura NO SHALL matar el programa; solo el plazo existente SHALL hacerlo.

#### Scenario: Proceso desbocado que no termina
- **WHEN** el límite es 1000 bytes y un programa escribe 10 000 bytes en su salida estándar y no
  termina
- **THEN** lo mata el plazo existente y se informa el error de plazo, como hasta ahora

#### Scenario: Plazo antes del límite
- **WHEN** un programa no escribe nada y vence su plazo
- **THEN** se mata y se informa el error de plazo, como hasta ahora
