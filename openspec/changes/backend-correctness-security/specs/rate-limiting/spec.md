# Spec Delta

## ADDED Requirements

### Requirement: Tamaño máximo del cuerpo en el resto de escrituras
Toda petición `POST`, `PUT` o `PATCH` fuera de `/ingest/commit` y `/ingest/pr` SHALL rechazarse con
413 cuando su cuerpo supere `MAX_BODY_BYTES` (65 536 por defecto, entero mayor que 0), con la misma
respuesta, el mismo corte por `Content-Length` o por bytes recibidos y el mismo orden (antes de la
autenticación y del límite de peticiones) que el límite de la ingesta. Las demás peticiones NO
SHALL verse afectadas.

#### Scenario: Cuerpo enorme fuera de la ingesta
- **WHEN** con `MAX_BODY_BYTES=65536` llega `POST /projects` con `Content-Length: 70000`
- **THEN** la API responde 413 sin invocar la ruta

#### Scenario: PUT sin Content-Length por encima del tope
- **WHEN** llega `PUT /projects/{slug}/agents` por trozos cuya suma supera `MAX_BODY_BYTES`
- **THEN** la respuesta es 413 y la selección no cambia

#### Scenario: Cuerpo dentro del tope
- **WHEN** llega `PUT /projects/{slug}/agents` con un cuerpo menor que `MAX_BODY_BYTES`
- **THEN** la petición se procesa con normalidad

#### Scenario: Lecturas y borrados
- **WHEN** llega un `GET` o un `DELETE`
- **THEN** este límite no interviene

#### Scenario: Configuración inválida
- **WHEN** `MAX_BODY_BYTES` es 0 o negativo
- **THEN** la configuración se rechaza al arrancar
