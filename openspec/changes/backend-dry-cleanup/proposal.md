# Proposal

## Por qué

El backend está bien estratificado, pero arrastra pequeñas duplicaciones que se copian cada vez
que se añade un endpoint o un evento: el mapeo de `ProjectNotFound` a 404 está escrito siete
veces y el de `ReviewStartError` a 503 cuatro, la inserción de una fila del outbox se repite en
tres adaptadores, `schemas.py` mapea dos veces los mismos dieciséis campos de un change y además
serializa y revalida cada fila del canal (`model_dump()`), y hay validadores y guardias triviales
calcados. Es la fase 2 del plan de refactor: una vez el tooling es fiable, eliminar las copias
antes de tocar la estructura del frontend.

## Qué cambia

- **Mapeo de excepciones a HTTP en un sitio.** `ProjectNotFound` → 404 y `ReviewStartError` → 503
  pasan a exception handlers registrados en `create_app`; los routers dejan de capturarlas. Los
  mensajes, los códigos y el contrato OpenAPI no cambian.
- **Outbox con un único punto de escritura.** `append_event(session, event)` en persistencia;
  los repositorios de changes, reviews y marcas de commit lo usan en vez de repetir el `insert`.
- **Un solo mapeo de change en `schemas.py`.** Los dieciséis campos comunes de
  `ChangeSummaryResponse`, `ChangeListItemResponse` y `ChangeDetailResponse` salen de una función;
  el elemento del canal se construye directamente, sin `model_dump()` por fila.
- **Trivialidades**: un único «blank is unset» en `config.py`, una guardia de slug en el
  repositorio de proyectos, y se retira el alias muerto `CommitSubmission`.

Sin cambio de comportamiento observable: el snapshot `docs/openapi.json` y los tests de
entrypoints, que comprueban códigos y mensajes exactos, protegen el refactor.

## Capacidades

### Nuevas capacidades

(ninguna: refactor sin cambio de comportamiento; `skip_specs: true`)

### Capacidades modificadas

(ninguna)

## Impacto

- `backend/src/duelo/entrypoints/api/` (`app.py`, nuevo `errors.py`, routers `ingest`,
  `projects`, `stats`, `project_agents`, `local_projects`, `changes`, `schemas.py`),
  `backend/src/duelo/adapters/persistence/` (nuevo `events.py`, `change_repository.py`,
  `review_repository.py`, `commit_marks.py`), `config.py`, `project_repository.py`,
  `application/ingest_commit.py` y el test que usaba el alias.
- Sin dependencias nuevas. `docs/openapi.json` debe quedar byte a byte igual.
- Done-when: `just ci` en verde, el snapshot de OpenAPI sin cambios, ni un `except ProjectNotFound`
  ni `except ReviewStartError` en los routers, y una sola llamada a `insert(EventModel)`.
