# Spec Delta

## ADDED Requirements

### Requirement: La salida cruda solo se lee en su endpoint
Las lecturas de las reviews de un change que hacen el detalle, el reintento y la nota de git NO
SHALL leer de la base de datos la salida cruda (`raw_output`) de ninguna review. Solo
`GET /reviews/{id}/raw-output` SHALL leerla.

#### Scenario: Detalle de un change con salida cruda grande
- **WHEN** un change tiene reviews con varios megabytes de salida cruda en varias runs y se pide su
  detalle
- **THEN** la consulta de sus reviews no incluye la columna de la salida cruda y la respuesta es la
  misma que hasta ahora

#### Scenario: El endpoint del operador sigue funcionando
- **WHEN** el operador pide la salida cruda de una de esas reviews con un token válido
- **THEN** la respuesta es 200 con el `raw_output` guardado completo
