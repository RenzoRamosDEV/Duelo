# Spec Delta

## ADDED Requirements

### Requirement: El reintento decide con un recuento de estados
Para decidir si un change admite reintento, el sistema SHALL contar las reviews de su `run` actual
por estado con una única consulta agregada, sin cargar el contenido de las reviews. La decisión
SHALL ser la misma que con las reviews completas.

#### Scenario: Run actual con un fallo
- **WHEN** el run actual de un change tiene una review `completed` y una `failed` y se pide el
  reintento
- **THEN** el reintento se acepta y no se lee el contenido de ninguna review

#### Scenario: Reviews de runs anteriores
- **WHEN** el run 1 tiene dos reviews `failed` y el run actual (2) tiene dos `completed`
- **THEN** el reintento responde 409, como hasta ahora

### Requirement: Sin transacción abierta mientras se arranca el reintento
El reintento SHALL terminar la transacción de las lecturas antes de pedir al orquestador que
arranque la ejecución: mientras esa llamada está en curso, la conexión a la base de datos del
reintento NO SHALL tener ninguna transacción abierta.

#### Scenario: Orquestador lento
- **WHEN** se reintenta un change fallido y el orquestador tarda en arrancar la ejecución
- **THEN** durante esa espera la sesión del reintento no tiene ninguna transacción abierta, y
  después `run` avanza como hasta ahora

#### Scenario: Orquestador caído
- **WHEN** el orquestador falla al arrancar la ejecución
- **THEN** la respuesta es 503, el `run` no cambia y no queda ninguna transacción abierta
