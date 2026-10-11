# Design

## Context

- `ReviewChangeWorkflow` (hijo) lanza una activity `run_review` por agente en la queue `agents` y
  devuelve la lista de resultados; ya tiene dos marcadores de parche (`compensate-infra-failure`,
  `readable-workflow-names`) y replays de historias grabadas (`legacy_*.py`).
- El worker `agents` corre en la máquina del usuario, donde están los repositorios locales
  (`ProjectPaths.path_of`, implementado por `SqlAlchemyProjectRepository`) y la credencial de git
  del usuario (SSH o credential helper). `adapters/git/` ya invoca `git` por `run_command`.
- `ReviewRepository.list_for_change` devuelve todas las reviews del change ordenadas por fecha.
- Postgres de desarrollo: contenedor `duelo_postgres_1` (compose), usuario `duelo`; Temporal usa
  el mismo servidor con las bases `temporal` y `temporal_visibility`.

## Goals / Non-Goals

**Goals:**
- Una evaluación terminada queda, además de en la base de datos, en el repositorio revisado y en
  su remoto, sin servicios nuevos.
- Una copia completa y restaurable de la base de datos en un fichero pequeño, programable.

**Non-Goals:**
- Reimportar notas a la base de datos (el camino de vuelta es el dump).
- Comentarios en GitHub, notas de PR, ni notas para changes de tipo PR cuyo head no esté en el
  repo local (se omiten con motivo).
- Backups fuera de la máquina gestionados por Duelo: se documenta `rclone`/carpeta sincronizada.
- Cambiar el apagado/reinicio del compose (`restart:`), que es otro change.

## Decisions

1. **Activity nueva `archive_reviews` al final del hijo, bajo `workflow.patched("archive-reviews")`.**
   Se ejecuta una vez por run cuando `gather` de las reviews ha terminado (incluidas las
   compensadas), con `ArchiveReviewsInput(change_id, run)`; devuelve `ArchiveReviewsResult(status,
   detail)` con `status ∈ {written, pushed, skipped, failed}`. Timeout `start_to_close` 2 min,
   la `RetryPolicy` compartida, sin heartbeat (un `git push` no necesita latidos). El resultado
   no altera la salida del workflow (sigue devolviendo `list[RunReviewResult]`): los llamadores
   y el padre no cambian. Alternativa descartada: hacerlo dentro de `run_review` por agente; la
   nota contiene a todos los agentes y debe escribirse una vez.
2. **Puerto `ReviewArchive` en `application/ports.py`** (`archive(repo_path, change, reviews) ->
   ArchiveOutcome`) y adaptador `adapters/git/notes_archive.py` (`GitNotesArchive(push: bool)`):
   `git -C <repo> cat-file -e <sha>^{commit}` (existe), `git notes --ref=duelo add -f -F <fichero
   0600 temporal> <sha>`, y si `push`: `git push origin refs/notes/duelo:refs/notes/duelo`, con el
   `run_command` existente (sin shell, entorno filtrado, timeout). Un fallo devuelve `failed` con
   un motivo corto sin rutas ni salida del CLI (puede contener URLs con token). Alternativa:
   `git notes append`; descartada por dejar notas crecientes y repetidas en los reintentos.
3. **Contenido de la nota: lógica pura en `application/review_notes.py`**,
   `render_review_note(change, reviews) -> str`: JSON con `schema: 1`, `project`, `sha`, `kind`,
   `title`, `run`, `written_at` (del reloj de la activity, pasado como argumento) y `reviews`
   (agent, status, score, summary, findings, duration_ms, error, created_at). Sin `raw_output`
   (puede ser grande y sucio). Solo las reviews de la run pedida; `-f` sustituye la nota en cada
   run. Alternativa: una nota con todas las runs; descartada, la base de datos y el dump ya las
   guardan.
4. **Ajustes del worker**: `REVIEW_NOTES=true` y `REVIEW_NOTES_PUSH=true` en `WorkerSettings`.
   Con `REVIEW_NOTES=false` el worker registra la activity igualmente (el workflow la llama) pero
   la activity responde `skipped` sin tocar git. Así el parche no depende del ajuste.
5. **Qué no es fallo**: sin carpeta local, sin el commit en local (PR no traído), sin `origin`:
   `skipped` con motivo; `git` o el push en error: `failed` con motivo. Ambos se registran en el
   log del worker y en los detalles de Temporal; nunca lanzan. La activity solo lanza
   `ApplicationError(non_retryable)` si el change no existe (configuración).
6. **Backups en `justfile`**, sin script aparte: `backup dir="backups" keep="14"` hace
   `podman exec duelo_postgres_1 pg_dumpall -U duelo --clean --if-exists | zstd -q -o
   <dir>/duelo-<YYYYmmdd-HHMMSS>.sql.zst` y borra las copias sobrantes por orden de nombre;
   `restore file`: comprueba que `duelo` está vacía (`select count(*) from changes` = 0 o la base no
   existe), y carga con `zstd -dc <file> | podman exec -i duelo_postgres_1 psql -U duelo -d
   postgres -v ON_ERROR_STOP=1`. `--clean --if-exists` permite restaurar sobre bases recién creadas
   por `auto-setup`. `zstd` es requisito documentado (ya está en Fedora/brew). Alternativa: un
   Temporal Schedule que dispare el dump; descartada, mete la copia dentro de lo que copia.
7. **Programación**: sección «Copias de seguridad» en `README.md` con la línea de cron y el par
   `.service`/`.timer` de systemd de usuario, y `rclone sync backups/ remote:duelo-backups`
   como ejemplo. `backups/` en `.gitignore`.

## Risks / Trade-offs

- [El push desde un proceso en segundo plano puede pedir contraseña y colgarse] → `GIT_TERMINAL_PROMPT=0`
  y `GIT_SSH_COMMAND="ssh -o BatchMode=yes"` en el entorno del comando: sin credencial no
  interactiva, el push falla rápido y queda como `failed`.
- [Notas en un repo compartido] → viven en `refs/notes/duelo`, fuera de `main`; `git log` no las
  muestra salvo `--notes=duelo`; quien no las quiera no las trae.
- [Tamaño de la nota] → hallazgos ya acotados (≤ 50 × 2 000 caracteres) y sin salida cruda: < 150 KB
  en el peor caso, unos KB en el habitual.
- [`pg_dumpall` incluye roles y contraseñas de desarrollo] → son las del compose (`duelo/duelo`);
  el fichero se trata como privado igualmente (documentado).
- [El parche nuevo cambia la secuencia de comandos] → `workflow.patched`; los replays de
  `legacy_review_change.py` y `legacy_review_commit.py` siguen en CI. Se graba una historia nueva
  con el código de este change para el siguiente parche.
