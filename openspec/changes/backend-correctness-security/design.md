# Design

## Context

Observado el 2026-10-21 sobre `backend/src/duelo`:

- `entrypoints/api/app.py` registra CORS con `allow_methods=["GET", "POST", "DELETE"]`; el front
  guarda la selección con `PUT /projects/{slug}/agents`.
- `entrypoints/hook.py` recorta el diff a `MAX_DIFF_CHARS = 1_000_000` y serializa con
  `json.dumps(payload)` (ASCII escapado: una `ñ` ocupa 6 bytes). `_send_all` descarta cualquier
  excepción con `continue`. El bloque instalado redirige la salida del hook a `/dev/null` y el
  hijo desacoplado duplica `/dev/null` sobre los fd 0–2.
- El número de reviews esperadas se recalcula en cada lectura con la selección actual:
  `queries.list_changes` (`len(project.agents) or expected_agents`, que llega como parámetro SQL a
  `_status_predicate`), `queries.get_change_detail` y `retry_review` (vía `expected_agents_for`).
  El starter de Temporal elige los agentes con la misma regla (`chosen or agent_names`).
- `SqlAlchemyReviewRepository.agent_stats` agrega todas las filas de `reviews`, incluidas las
  copiadas (`reused_from_change_id IS NOT NULL`).
- `BodyLimitMiddleware` solo actúa sobre `POST` a `/ingest/commit` y `/ingest/pr`.
- `adapters/git/history.py` tiene el blindaje (`_GIT_ENV`, `_GIT_EXCLUDED_ENV`, `_GIT_HARDENING`);
  `notes_archive.py`, `local_repository.py` y `hook_installer.py` llaman a `run_command(["git",
  ...])` sin él. `GitNotesArchive` pasa `change.head_sha` a `git` sin validar.

## Goals / Non-Goals

**Goals:**
- Corregir los cuatro bugs y cerrar los dos huecos de seguridad con el mínimo código nuevo.
- Cero cambios en el contrato OpenAPI.

**Non-Goals:**
- `X-Operator-Token` en CORS, `raw_output`, separar tokens, rendimiento de consultas, filtrar
  secretos del diff.
- Hacer visibles los fallos del hook en la terminal del usuario (ver Riesgos).
- Recortar el diff en `adapters/github/gh_cli.py` (no pasa por HTTP; la ingesta ya lo trunca).

## Decisions

**CORS.** Añadir `"PUT"` a la lista. Sin `PATCH`: ninguna ruta lo usa (YAGNI).

**Hook.** `MAX_DIFF_CHARS = 200_000` como literal en `hook.py`: el hook es un script autónomo que
no importa `config.py` (no carga la configuración del servidor en el git del usuario); un test
unitario fija que coincide con el default de `Settings.max_diff_chars`. `post` serializa con
`json.dumps(payload, ensure_ascii=False).encode("utf-8")`. `_send_all` captura el fallo, escribe
`duelo-hook: <sha[:7]> <motivo>` en `sys.stderr` (motivo: `HTTPError.code` si es un error HTTP,
si no `type(exc).__name__`) y sigue. El texto nunca incluye URL, token ni diff.

**Reviews esperadas por run: columna en `changes`.**
- `Change.expected_agents: int | None = None` en el dominio; `ChangeModel.expected_agents`
  `Integer NULL`.
- Se fija al crear el change: `_ingest` calcula `len(project.agents or agent_names) or None` y lo
  pasa a `ingest_change` → `Change.new`. `ingest_commit` recibe también `agent_names` (los
  configurados) desde `composition.py`, igual que `ingest_pr`. Una reingesta idempotente no lo
  toca (el change ya existe y se devuelve tal cual).
- Se fija en cada reintento: `advance_run(change_id, *, from_run, started_at, expected_agents)`
  lo escribe en el mismo `UPDATE` compare-and-swap que avanza `run`. `retry_review` calcula el
  valor con `expected_agents_for` (la misma regla que el starter).
- Lectura: una función `expected_agents_of(change, projects, fallback)` en
  `application/project_agents.py` devuelve `change.expected_agents` si no es `None` y, si no, la
  lógica actual; la usan `get_change_detail` y `retry_review`. En el canal, el valor de reserva
  (`len(project.agents) or expected_agents`) sigue llegando como parámetro y el repositorio usa
  `coalesce(changes.expected_agents, :fallback)` tanto en `_status_predicate` como en el
  `review_status` calculado por fila, así que filtro y estado devuelto coinciden.
- Alternativa descartada: que `ReviewStarter.start` devuelva los agentes arrancados. Es la fuente
  más exacta, pero cambia un puerto y todos sus fakes por un caso de carrera (la selección cambia
  entre la lectura y el arranque) que no merece el coste.
- Alternativa descartada: guardar la lista de nombres. El estado solo necesita el número y la
  columna `INTEGER` es lo que se pide.

**Migración.** Revisión nueva sobre `i9f7a1d5e348`. `upgrade`: `add_column` y un único
`UPDATE changes c SET expected_agents = sub.n FROM (SELECT change_id, count(DISTINCT agent) n
FROM reviews r JOIN changes c2 ON c2.id = r.change_id AND r.run = c2.run GROUP BY change_id) sub
WHERE sub.change_id = c.id`. «Run más reciente» se interpreta como el `run` actual del change (el
que gobierna el estado); un change que avanzó de run sin reviews nuevas queda `NULL` y se calcula
como hoy. `downgrade`: `drop_column`.

**Estadísticas.** `.where(ReviewModel.reused_from_change_id.is_(None))` en la consulta base,
antes de la rama del filtro por proyecto: aplica a los dos casos con una sola línea.

**Límite de cuerpo.** `BodyLimitMiddleware(app, *, max_bytes, ingest_max_bytes,
ingest_paths=INGEST_PATHS)`: actúa si el método está en `{"POST", "PUT", "PATCH"}` y elige el
tope por ruta. El 413 lleva el tope aplicado en el mensaje, como hoy. Nuevo ajuste
`max_body_bytes: int = Field(default=65_536, gt=0)` (env `MAX_BODY_BYTES`), fila nueva en la tabla
del README. El orden de middlewares no cambia.

**Blindaje de git.** Nuevo `adapters/git/command.py` con
`run_git(path, *args, timeout, env=None, isolate_user_config=True, disable_hooks=True)`:
- Siempre: `GIT_CONFIG_NOSYSTEM=1`, `-c core.fsmonitor=false`, `exclude_env` con `GIT_DIR`,
  `GIT_WORK_TREE`, `GIT_INDEX_FILE`, `GIT_COMMON_DIR`, `-C path`.
- `disable_hooks`: `-c core.hooksPath=/dev/null`. Solo `hook_installer._hooks_dir` pasa `False`.
- `isolate_user_config`: `GIT_CONFIG_GLOBAL=/dev/null`, como `history.py` hoy. `notes_archive`
  y `hook_installer` pasan `False`: la nota necesita la identidad (`user.name`/`user.email`) y
  la credencial del usuario para el push (lo exige «Empuje de la referencia de notas»), y el
  instalador debe ver un `core.hooksPath` global para rechazarlo si apunta fuera del repo.
  `local_repository` e `history` usan el default (aislado).
- `env` extra se fusiona (notes conserva `GIT_TERMINAL_PROMPT=0` y `GIT_SSH_COMMAND`).
- Cada adaptador conserva su traducción de `CommandNotFound`/`CommandTimeout` a su propia
  excepción o resultado: el helper no captura nada.

**SHA en el archivo de notas.** `GitNotesArchive.archive` comprueba `is_safe_sha_argument(sha)`
antes de nada; si falla, `logger.warning` y lanza `UnsafeArchiveTarget` (nueva excepción en
`application/ports/reviews.py`, junto a `ReviewArchive`). La activity `archive_reviews` la
traduce a `ApplicationError(non_retryable=True)`, la misma forma no reintentable que ya usa para
«Change no existe»: el adaptador no importa Temporal. El workflow no cambia (no hace falta
`workflow.patched`).

## Risks / Trade-offs

- **Fallos del hook en stderr, pero invisibles en la instalación por defecto.** El bloque
  instalado hace `>/dev/null 2>&1` y el hijo desacoplado cierra los fd 0–2 para no retener la
  terminal ni un pipe que lea la salida de git. La línea se ve al ejecutar el hook a mano o en el
  camino sin `fork`. Hacerla visible en la terminal exigiría cambiar el bloque instalado y
  reinstalar los hooks: queda como follow-up (p. ej. un log en `~/.config/duelo/`).
- **Relleno de changes en vuelo.** Un change con el run a medias al migrar (1 de 2 reviews) queda
  con `expected_agents = 1` y pasa a `completed` aunque llegue la segunda. Mitigación: migrar sin
  runs en curso (`just migrate` con el worker parado tras vaciar la cola); se documenta en la
  tarea de la migración.
- **Carrera selección/arranque.** Si la selección cambia entre que el caso de uso lee el número y
  el starter lee los agentes, ambos pueden diferir. Ventana de milisegundos en un sistema de un
  solo usuario; aceptado.
- **SHA inseguro: el workflow termina en fallo.** La activity no reintentable propaga el error y
  el workflow acaba `Failed`, aunque las reviews ya estén guardadas y el estado del change no
  cambie. Es el comportamiento pedido y solo ocurre con una ingesta maliciosa.
- **`MAX_BODY_BYTES` de 64 KiB.** El cuerpo más grande fuera de la ingesta hoy es el de
  `POST /projects` o `PUT /projects/{slug}/agents` (cientos de bytes). Holgura amplia.
- No hay desviaciones del stack ni de la arquitectura fijada: no procede ADR.

## Migration Plan

1. Desplegar el código y aplicar la migración con el worker parado y sin runs en curso.
2. Rollback: `alembic downgrade -1` elimina la columna; el código anterior no la lee.
Commits atómicos por bloque: `fix(api)` CORS, `fix(hook)`, `fix(persistence)` reviews esperadas
(+ migración), `fix(stats)`, `fix(api)` límite de cuerpo, `fix(git)` blindaje y SHA.

## Open Questions

Ninguna. Decisiones tomadas en modo autónomo (todas anotadas arriba): interpretación de «run más
reciente», `isolate_user_config=False` para notas e instalador, excepción de aplicación traducida
en la activity, y stderr del hook sin cambiar el bloque instalado.
