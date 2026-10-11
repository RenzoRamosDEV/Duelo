# Tasks

## 1. Nota de la review (lógica pura y puerto)

- [x] 1.1 `application/review_notes.py`: `render_review_note(change, reviews, written_at) -> str` (JSON `schema: 1` con proyecto, sha, tipo, título, run, `written_at` y las reviews de esa run sin `raw_output`; hallazgos tal cual). Puerto `ReviewArchive` y `ArchiveOutcome(status, detail)` en `application/ports.py`. Tests unitarios: contenido y claves del JSON, solo la run pedida, sin `raw_output`, hallazgos completos, serializable sin fechas naive. Verificación: `uv run pytest tests/unit/application/test_review_notes.py --no-cov`.

## 2. Adaptador de git

- [x] 2.1 `adapters/git/notes_archive.py`: `GitNotesArchive(push: bool)` con `cat-file -e`, `notes --ref=duelo add -f -F <fichero 0600>` y `push origin refs/notes/duelo:refs/notes/duelo`; `GIT_TERMINAL_PROMPT=0` y `GIT_SSH_COMMAND="ssh -o BatchMode=yes"`; resultados `written`/`pushed`/`skipped`/`failed` con motivos cortos sin rutas ni salida del CLI. Tests unitarios con repositorios git temporales (`git init`, un commit, un remoto `bare` local): nota escrita y legible con `git notes --ref=duelo show`, segunda escritura sustituye, push deja la ref en el bare, sha inexistente → `skipped`, sin remoto → `skipped` al empujar, `push=False` no toca el bare, fallo de git → `failed` sin filtrar la salida. Verificación: `uv run pytest tests/unit/adapters/git/test_notes_archive.py --no-cov`.

## 3. Activity, workflow y worker

- [x] 3.1 `workflows/dto.py`: `ArchiveReviewsInput(change_id, run)` y `ArchiveReviewsResult(status, detail="")`. `workflows/activities.py`: activity `archive_reviews` (carga el change y `list_for_change` filtrando por run; `ProjectPaths.path_of`; `skipped` sin carpeta o con `REVIEW_NOTES` apagado; `ApplicationError(non_retryable)` si el change no existe). `ReviewActivities` recibe `archive: ReviewArchive | None` y `project_paths`. Tests unitarios de la activity con fakes (`tests/unit/workflows/`): sin carpeta → `skipped`; con archivo fake → llamado con las reviews de la run; change inexistente → no reintentable. Verificación: `uv run pytest tests/unit/workflows --no-cov`.
- [ ] 3.2 `workflows/review_change.py`: tras `gather`, bajo `workflow.patched("archive-reviews")`, `execute_activity("archive_reviews", …, task_queue=agents, start_to_close_timeout=2 min, retry_policy=RETRY, summary="guarda la nota de <sha>")`; el resultado no cambia la salida del workflow. `worker.py`: registra la activity y construye `GitNotesArchive(push=settings.review_notes_push)`; `config.py`: `review_notes: bool = True`, `review_notes_push: bool = True`. Tests: integración (`tests/integration/workflows/`) con un archivo fake registrado: la activity corre una vez por run tras las reviews, con las dos reviews; un archivo que devuelve `failed` deja el workflow `completed`; `legacy_review_change.py`/`legacy_review_commit.py` siguen reproduciéndose; grabar una historia nueva con este código para el siguiente parche. `tests/unit/test_config.py`: valores por defecto y lectura de `REVIEW_NOTES_PUSH=false`. Verificación: `uv run pytest tests/integration/workflows tests/unit/test_config.py --no-cov` (con `DOCKER_HOST` de Podman).

## 4. Copias de seguridad

- [x] 4.1 `justfile`: `backup dir="backups" keep="14"` (comprueba el contenedor, `pg_dumpall --clean --if-exists | zstd`, nombre fechado, retención por nombre) y `restore file` (se niega si `changes` tiene filas; `zstd -dc | psql -v ON_ERROR_STOP=1`). `backups/` en `.gitignore`. Verificación manual con la infra arriba: `just backup` crea el fichero y `zstd -dc` muestra `CREATE DATABASE temporal`; con 15 copias ficticias quedan 14; `just restore` sobre la base con datos falla; con un volumen nuevo (`just down`, `podman volume rm duelo_postgres_data`, `podman-compose --profile infra up -d`) restaura y la API lista los changes anteriores.
- [x] 4.2 `README.md`: sección «Copias de seguridad y notas de git» (qué guarda cada mecanismo, `just backup`/`restore`, cron y timer de systemd de usuario, `rclone`, `git notes --ref=duelo show <sha>` y `git fetch origin refs/notes/duelo:refs/notes/duelo` para leerlas en otra máquina, variables `REVIEW_NOTES`/`REVIEW_NOTES_PUSH`). `docs/architecture.md` (activity y puerto nuevos), `docs/testing.md` (filas nuevas), `docs/temporal-buenas-practicas.md` (WF-4: marcador `archive-reviews`). Verificación: `grep -n "archive-reviews\|just backup" README.md docs/*.md`.

## 5. Cierre

- [x] 5.1 `just ci` en verde y una review real (`just dev` + `just worker` con `AGENT_NAMES=claude,codex`) sobre un commit de este repo: `git notes --ref=duelo show <sha>` muestra las dos reviews y `git ls-remote origin refs/notes/duelo` devuelve la ref. Verificación: salida de ambos comandos.

## Workflow follow-up

- Archivar el change (`openspec archive`) y commit/push cuando el usuario lo pida.
