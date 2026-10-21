# Tasks

Cada tarea sigue TDD: primero el test en rojo (ejecutado y visto fallar por el motivo esperado),
después el código mínimo que lo pone en verde y, al final, el refactor con los tests en verde.

## 1. CORS

- [x] 1.1 Rojo: en `tests/unit/entrypoints/test_cors.py`, un preflight `OPTIONS
      /projects/duelo/agents` con `Origin: http://localhost:5173` y
      `Access-Control-Request-Method: PUT` (con `ALLOWED_ORIGINS=http://localhost:5173`) espera 200
      y `PUT` en `Access-Control-Allow-Methods`. Verde: añadir `"PUT"` a `allow_methods` en
      `entrypoints/api/app.py`; los escenarios de `DELETE` y de origen no permitido siguen en verde.

## 2. Hook

- [x] 2.1 Rojo: en `tests/unit/entrypoints/test_hook.py`, con `_git` sustituido por un fake, un
      diff de 300 000 `ñ` produce un `diff` de 200 000 caracteres; el cuerpo que `post` envía
      (capturado con un opener falso) ocupa menos de 1 500 000 bytes y no contiene `\u`; y
      `hook.MAX_DIFF_CHARS == Settings.model_fields["max_diff_chars"].default`. Bordes: diff de
      199 999, 200 000 y 200 001 caracteres. Verde: `MAX_DIFF_CHARS = 200_000` y
      `json.dumps(payload, ensure_ascii=False).encode("utf-8")`.
- [x] 2.2 Rojo: `_send_all` con dos commits, el primero falla con `HTTPError` 413 y el segundo va
      bien → `capsys` ve una sola línea con `sha[:7]` y `413`, el segundo se envía; con
      `URLError`/`TimeoutError` la línea lleva el nombre del tipo; la línea no contiene el token
      ni la URL; `main` sigue devolviendo 0. Verde: escribir la línea en `sys.stderr` en el
      `except` de `_send_all`.

## 3. Reviews esperadas por run

- [x] 3.1 Rojo (unit, dominio y aplicación con fakes): `Change.new(..., expected_agents=2)`
      conserva el valor y el default es `None`; `ingest_commit`/`ingest_pr` crean el change con
      `len(project.agents or agent_names)` (y `None` si ambos están vacíos); una reingesta no lo
      cambia; `expected_agents_of` devuelve el guardado si no es `None` y la lógica anterior si
      lo es (bordes: guardado 1 con selección 2; `None` con selección vacía → configurados).
      Verde: campo en `Change`, `agent_names` en `ingest_commit` (y en `composition.py`), helper
      en `application/project_agents.py`.
- [x] 3.2 Rojo (unit con fakes): `retry_review` de un change `completed` con `expected_agents=1`
      cuya selección pasó a 2 responde `RetryNotAllowed`; el de un change `failed` llama a
      `advance_run` con `expected_agents=2`; `get_change_detail` devuelve `completed` para el
      primero. Verde: `retry_review` y `get_change_detail` usan `expected_agents_of`; nuevo
      parámetro `expected_agents` en el puerto `ChangeRepository.advance_run` y en su fake.
- [x] 3.3 Rojo (integración, `tests/integration/persistence`): el escenario «Cambio de agentes
      tras revisar» — el canal sin filtro y con `status=completed` devuelve el change como
      `completed` tras pasar la selección a 2; un change con `expected_agents = NULL` se calcula
      como antes; `advance_run` guarda el nuevo valor; el test de la matriz
      `_status_predicate`/`review_status_from_counts` sigue en verde. Verde: columna en
      `ChangeModel`, `add` y `_to_domain` la mapean, `advance_run` la escribe y
      `list_for_project` usa `coalesce(changes.expected_agents, :fallback)` en el predicado y en el
      estado por fila.
- [x] 3.4 Rojo (integración, `test_migrations.py`): con datos sembrados antes de la revisión, un
      change en run 2 con reviews de `claude` y `codex` en el run 2 y de `claude` en el run 1
      queda con 2; uno sin reviews en su run queda `NULL`; `downgrade` elimina la columna sin
      tocar filas. Verde: migración Alembic nueva sobre `i9f7a1d5e348` con `add_column`, el
      `UPDATE ... FROM` del diseño y `drop_column`. Anotar en el docstring que se aplica sin runs
      en curso.

## 4. Estadísticas

- [x] 4.1 Rojo (integración, `test_sqlalchemy_review_repository.py`): el escenario «PR que
      reutiliza reviews» — commit con review `completed` de `claude` (score 8) y una PR que la
      reutiliza → `total = 1`, `completed = 1`, `avg_score = 8`, tanto global como con
      `project_id`. Verde: filtro `reused_from_change_id IS NULL` en `agent_stats`.

## 5. Límite de cuerpo

- [x] 5.1 Rojo: `tests/unit/test_config.py` — `max_body_bytes` vale 65 536 por defecto y rechaza
      0 y negativos. Verde: el campo en `Settings`.
- [x] 5.2 Rojo: `tests/unit/entrypoints/test_body_limit.py` — `POST /projects` con
      `Content-Length: 70000` → 413 sin invocar la ruta; `PUT` y `PATCH` por trozos por encima del
      tope → 413; `PUT` de 65 536 bytes pasa y de 65 537 no (bordes); `POST /ingest/commit` de
      100 000 bytes pasa y por encima de `max_ingest_body_bytes` → 413; `GET`, `DELETE` y
      `OPTIONS` no se tocan. Verde: `BodyLimitMiddleware` con `max_bytes`/`ingest_max_bytes` y
      los tres métodos; `app.py` le pasa ambos ajustes. Actualizar el escenario «Otras rutas»
      existente.
- [x] 5.3 README: fila `MAX_BODY_BYTES` (`65536`) en la tabla de variables, junto a
      `MAX_INGEST_BODY_BYTES`.

## 6. Blindaje de git

- [x] 6.1 Rojo: `tests/unit/adapters/git/test_command.py` — con `run_command` sustituido por un
      espía, `run_git` pasa `-c core.fsmonitor=false`, `-c core.hooksPath=/dev/null`, `-C path`,
      `GIT_CONFIG_NOSYSTEM=1`, `GIT_CONFIG_GLOBAL=/dev/null` y excluye `GIT_DIR` y afines; con
      `disable_hooks=False` no fuerza `core.hooksPath`; con `isolate_user_config=False` no fija
      `GIT_CONFIG_GLOBAL`; el `env` extra se fusiona. Verde: `adapters/git/command.py`.
- [x] 6.2 Rojo (con repos git reales en `tmp_path`, ya usados por los tests de `adapters/git`): un
      repo con `core.fsmonitor` apuntando a un script que deja un fichero testigo no lo ejecuta en
      `LocalGitRepository.inspect`, `GitNotesArchive.archive` ni `LocalGitHistory`; con
      `GIT_DIR` apuntando a otro repo en el entorno, `inspect` devuelve el del proyecto; el
      instalador sigue respetando un `core.hooksPath` interno y rechazando uno externo. Verde:
      `history.py`, `notes_archive.py`, `local_repository.py` y `hook_installer.py` llaman a
      `run_git`; borrar las constantes duplicadas de `history.py`.
- [x] 6.3 Rojo: `GitNotesArchive.archive` con `head_sha="--exec=evil"` (y bordes: 6 y 65
      caracteres hexadecimales, vacío) lanza `UnsafeArchiveTarget`, registra un warning
      (`caplog`) y el espía de `run_command` no recibe ninguna llamada; con 7 y 40 hexadecimales
      sigue escribiendo la nota. En `tests/unit/workflows`, la activity `archive_reviews` traduce
      esa excepción a `ApplicationError` con `non_retryable=True`. Verde: validación en el
      adaptador, la excepción en `application/ports/reviews.py` (exportada en la fachada) y la
      traducción en `workflows/activities.py`.

## 7. Mutation testing

- [x] 7.1 Mutation testing acotado al diff: `mutmut` solo sobre los ficheros de `domain/` y
      `application/` modificados (`domain/change.py`, `application/project_agents.py`,
      `application/queries.py`, `application/retry_review.py`, `application/ingest_commit.py`,
      `application/ingest_change.py`), sin tocar el `source_paths` del proyecto en el commit.
      Objetivo > 95 %; abortar si pasa de 3 minutos; justificar en el PR cada mutante
      superviviente. Los cambios en `adapters/` y `entrypoints/` quedan fuera de la configuración
      de `mutmut` del proyecto (necesitan Postgres o procesos git reales): se justifica y se cubre
      con los bordes de las tareas 2, 5 y 6.

      Resultado (`mutmut run "duelo.domain.change*" "duelo.application.{project_agents,queries,
      retry_review,ingest_commit,ingest_change}*"`, ~30 s): las funciones tocadas por el change
      (`Change.new`, `ingest_change`, `ingest_commit`, `expected_agents_of`, `get_change_detail`,
      `retry_review`) dan **279/279 mutantes muertos (100 %)**. El único superviviente inicial
      (`retry_review` pasando `None` en vez de `project_agents` a `expected_agents_of`) lo mata
      `test_retrying_a_change_without_saved_agents_judges_it_by_the_current_selection`. Sobre los
      seis módulos enteros, `mutation_gate.py` da 475/497 = 95,6 %: los 22 restantes son
      `set_project_agents` (código previo sin cambios, `no tests` porque sus tests viven en
      `tests/unit/entrypoints`, fuera de la selección de `mutmut`) y 1 timeout de `list_changes`
      (el gate lo cuenta como muerto).

## 8. Verificación final

- [x] 8.1 `just lint`, `just typecheck` y `just test-unit` en verde.
- [x] 8.2 `just test-integration` en verde si hay Podman/Docker; si no, dejarlo indicado.
- [x] 8.3 En `frontend/`: `pnpm test` y `pnpm build` en verde.
- [x] 8.4 `docs/openapi.json` sin cambios (contrato intacto) y commits atómicos por bloque.
