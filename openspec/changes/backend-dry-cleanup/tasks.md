# Tasks

## 1. Excepciones a HTTP en un sitio

- [x] 1.1 `entrypoints/api/errors.py` con `register_error_handlers(app)` para `ProjectNotFound`
      (404, «Proyecto desconocido: {slug}») y `ReviewStartError` (503, «No se pudo arrancar la
      review, reintenta»); registrarlo en `create_app` cuando hay dependencias.
- [x] 1.2 Quitar las capturas de esas dos excepciones en `ingest`, `projects`, `stats`,
      `project_agents`, `local_projects` y `changes`; verificar `tests/unit/entrypoints` y el
      snapshot de `docs/openapi.json` sin cambios.

## 2. Outbox

- [x] 2.1 `adapters/persistence/events.py` con `append_event(session, event)`; usarlo en
      `change_repository.py` (dos puntos), `review_repository.py` y `commit_marks.py`; verificar
      que solo queda una llamada a `insert(EventModel)` y los tests de integración de persistencia.

## 3. Schemas

- [x] 3.1 `_change_fields` en `schemas.py` y las tres respuestas construidas con él, sin
      `model_dump()`; verificar el snapshot de OpenAPI y los tests de la API de lectura.

## 4. Trivialidades

- [x] 4.1 `config.py`: `_blank_is_unset` compartido y un validador en `Settings` para
      `hook_env_path` y `operator_token`; verificar `tests/unit/test_config.py`.
- [x] 4.2 `project_repository.py`: guardia única `_has_nul`; `ingest_commit.py`: quitar
      `CommitSubmission` y actualizar el test; verificar `just lint`.

## 5. Cierre

- [x] 5.1 `just ci` en verde; commits atómicos por bloque.
