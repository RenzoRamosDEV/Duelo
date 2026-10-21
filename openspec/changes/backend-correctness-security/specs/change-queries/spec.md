# Spec Delta

## MODIFIED Requirements

### Requirement: Métricas agregadas por agente
El sistema SHALL exponer `GET /stats/agents`, que devuelve por cada agente con reviews el
total, las completadas, las fallidas, la duración media y el score medio, ignorando los
valores nulos en las medias (media nula si no hay ningún valor). Las reviews reutilizadas (copiadas
de otro change) NO SHALL contar en ninguna métrica, ni en el agregado global ni en el filtrado por
proyecto. Con el parámetro opcional
`project=owner/repo` SHALL limitar las métricas a las reviews de los changes de ese proyecto;
sin él, el agregado es global. Un `project` desconocido SHALL responder 404, y uno con NUL o de
más de 255 caracteres, 422.

#### Scenario: Agente con reviews completadas y fallidas
- **WHEN** un agente tiene dos reviews completadas (score 8 y 6, 100 ms y 300 ms) y una fallida
  sin score
- **THEN** sus métricas son total 3, completadas 2, fallidas 1, score medio 7 y duración
  media 200 ms

#### Scenario: Agente solo con fallos
- **WHEN** un agente solo tiene reviews fallidas sin score
- **THEN** su score medio es nulo

#### Scenario: Sin reviews
- **WHEN** no hay ninguna review
- **THEN** la respuesta es 200 con una lista vacía

#### Scenario: Filtrado por proyecto
- **WHEN** existen reviews de un agente en los proyectos `a/repo` y `b/repo` y se pide
  `?project=a/repo`
- **THEN** las métricas solo cuentan las reviews de los changes de `a/repo`

#### Scenario: Proyecto sin reviews
- **WHEN** `project` existe pero sus changes no tienen reviews
- **THEN** la respuesta es 200 con una lista vacía

#### Scenario: Proyecto desconocido
- **WHEN** `project` no corresponde a ningún proyecto
- **THEN** la respuesta es 404

#### Scenario: PR que reutiliza reviews
- **WHEN** un commit tiene una review `completed` de `claude` con score 8 y una PR idéntica la
  reutiliza, y se piden las estadísticas, globales o del proyecto
- **THEN** `claude` tiene `total = 1`, `completed = 1` y `avg_score = 8`

### Requirement: Estado agregado de las reviews de un change
El sistema SHALL incluir en cada change del canal y en su detalle el campo `review_status`,
calculado sobre las reviews del `run` actual del change frente al número de reviews esperadas del
change (el guardado para su run o, si no lo hay, el de la selección actual del proyecto o el de
agentes configurados):
`pending` si no hay ninguna; `running` si hay menos que agentes; y, con todas registradas,
`completed` si ninguna falló, `failed` si todas fallaron y `partial_failed` en otro caso. Las
reviews de runs anteriores NO SHALL contar.

#### Scenario: Sin reviews
- **WHEN** un change recién ingerido no tiene reviews
- **THEN** su `review_status` es `pending`

#### Scenario: Faltan agentes
- **WHEN** hay dos agentes configurados y solo uno ha registrado su review, completada o fallida
- **THEN** el `review_status` es `running`

#### Scenario: Todas registradas
- **WHEN** ambos agentes han registrado su review
- **THEN** es `completed` si ninguna falló, `failed` si fallaron las dos y `partial_failed` si
  falló una

#### Scenario: Un reintento reinicia el estado
- **WHEN** el change avanza a `run = 2` y aún no hay reviews de ese run
- **THEN** su `review_status` es `pending`, aunque el run 1 tuviera reviews
