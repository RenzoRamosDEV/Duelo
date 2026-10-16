# Design

## Context

Medido el 2026-10-16 sobre `backend/src/duelo`: «Proyecto desconocido» aparece en 7 routers,
«No se pudo arrancar la review, reintenta» en 3 más la de `changes.retry`, `insert(EventModel)`
en 4 puntos de 3 ficheros, `schemas.py` repite el mapeo de change en `from_summary` y
`from_detail` y `ChangeListItemResponse.from_summary` hace `cls(**base.model_dump(), ...)` por
cada fila del canal. `config.py` tiene tres validadores idénticos que convierten `""` en `None`;
`project_repository.py` comprueba `"\x00" in slug` en tres métodos.

## Goals / Non-Goals

**Goals:**
- Una sola fuente para cada regla repetida, sin cambiar códigos, mensajes ni contrato.
- Quitar el trabajo inútil por fila del canal.

**Non-Goals:**
- Reorganizar `ports.py` por capacidad (fase 5).
- Cambiar textos de error o añadir códigos nuevos.
- Centralizar `ChangeNotFound`, `RetryNotAllowed` o los 422 de validación: aparecen una vez cada
  uno y su mapeo es específico de la ruta.

## Decisions

**Exception handlers de FastAPI para `ProjectNotFound` y `ReviewStartError`.** Un módulo
`entrypoints/api/errors.py` con `register_error_handlers(app)` que registra dos handlers y
devuelve `JSONResponse({"detail": ...})` con el mismo texto de hoy. Los routers conservan sus
`responses={404: ..., 503: ...}` para que el OpenAPI no cambie, y dejan de capturar esas dos
excepciones. `ingest._run` sigue existiendo solo para `ValueError` → 422 (es semántica de la
ingesta). Alternativa descartada: una dependencia común o un decorador por ruta; los handlers son
la pieza nativa para esto y no obligan a tocar cada firma.

**`append_event` como función, no como repositorio.** Vive en
`adapters/persistence/events.py` y recibe la sesión y el evento de dominio (todos exponen
`project_id`, `type` y `to_payload()`); sanea el payload como hasta ahora. Se llama dentro de la
transacción de quien escribe, igual que hoy. `commit_marks.apply` deja de pasar `project_id`
aparte: lo lleva el evento.

**Un constructor de campos comunes en `schemas.py`.** `_change_fields(change, *, review_status,
stale, commit_state, reverted_by)` acepta `Change | ChangeSummary` (comparten los trece campos
base) y devuelve el `dict` con los dieciséis del contrato. `ChangeSummaryResponse.from_summary`,
`ChangeListItemResponse.from_summary` y `ChangeDetailResponse.from_detail` lo usan; el elemento
del canal ya no pasa por `model_dump()`.

**Trivialidades.** `_blank_is_unset(value)` a nivel de módulo en `config.py`, y un único
validador en `Settings` para `hook_env_path` y `operator_token`. `_has_nul(slug)` en el
repositorio de proyectos. `CommitSubmission` se elimina y el test pasa a `ChangeSubmission`.

## Risks / Trade-offs

- **Orden de middlewares y handlers**: los exception handlers corren dentro de
  `ExceptionMiddleware`, por debajo de los middlewares propios, así que la respuesta sigue
  llevando `X-Request-ID` y el access log. Lo comprueban los tests de entrypoints existentes.
- **Snapshot de OpenAPI**: cualquier deriva la detecta `tests/unit/contract`.

## Migration Plan

Sin migración. Commits: `refactor(api)` handlers, `refactor(persistence)` outbox,
`refactor(api)` schemas, `refactor(backend)` trivialidades.

## Open Questions

Ninguna.
