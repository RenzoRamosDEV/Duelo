## 1. Backend: modelo y persistencia

- [x] 1.1 Migración Alembic: `projects.agents` (`ARRAY(String)`, nullable) y campo en `ProjectModel` y en `Project` (`agents: tuple[str, ...] | None`)
- [x] 1.2 Función de dominio que calcula la selección efectiva (guardada ∩ disponibles, orden de `AGENT_NAMES`, vacío → todos) con sus tests unitarios
- [x] 1.3 Puerto `ProjectAgents` (leer y guardar la selección) y adaptador SQLAlchemy, con test de integración contra Postgres

## 2. Backend: efecto en revisiones

- [x] 2.1 `TemporalReviewStarter` y la ingesta de PR usan los agentes efectivos del proyecto del change en vez de la lista global
- [x] 2.2 `composition.py`: `expected_agents` por proyecto en listado, detalle, reintento y filtro de estado
- [x] 2.3 Tests: commit con un agente elegido arranca solo a ese y queda «completado»; sin selección todo igual; cambio de selección con reviews previas no cambia el estado

## 3. API

- [x] 3.1 `agents` en `ProjectResponse` y `PUT /projects/{slug}/agents` (token, límite de peticiones, 401/404/422) con tests de endpoint
- [x] 3.2 Regenerar OpenAPI y cliente TypeScript (`just gen-client`) sin deriva

## 4. Frontend

- [x] 4.1 Cliente de datos: `setProjectAgents(slug, agents, token)` y `agents` en el tipo de proyecto
- [x] 4.2 `ProjectsSettings`: casillas por agente, Guardar deshabilitado con 0, aviso «aplica a los próximos commits», errores 401/404/422
- [x] 4.3 Comprobar que un change con una sola review no muestra un voto imposible; tests del componente de Ajustes

## 5. Cierre

- [x] 5.1 Actualizar README/`docs` donde se explique `AGENT_NAMES` (pasa a ser el conjunto disponible)
- [x] 5.2 `just ci` en verde y comprobación manual: elegir solo Codex en un proyecto, ingerir un commit y ver una única review
