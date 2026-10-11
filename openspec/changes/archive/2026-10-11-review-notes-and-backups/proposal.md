# Proposal

## Why

Todo lo que los agentes ya han evaluado (resumen, nota, hallazgos, votos) vive únicamente en la
tabla `reviews` del Postgres de `docker-compose.yml`. Si ese volumen se pierde (disco, `podman
system prune --volumes`, cambio de máquina o de servidor) se pierde todo el trabajo hecho, y no
hay copia en ningún otro sitio. El usuario quiere que una evaluación hecha no dependa de que esa
base de datos siga ahí, con el menor peso posible.

## What Changes

- **Cada review terminada se guarda también como nota de git en el repositorio revisado**
  (`refs/notes/duelo`, una nota por commit con el JSON de todos los agentes de la última run) y
  la referencia de notas se empuja a `origin`. Lo hace una activity nueva del workflow de
  revisión, en la task queue `agents` (la máquina del usuario, donde está el repositorio y su
  credencial de git). No es obligatoria: sin carpeta local, sin el commit en el repo, sin remoto
  o sin red, se registra y el workflow termina igual. Idempotente (`git notes add -f`).
- **Copia de seguridad de la base de datos** con dos recetas de `just`: `backup` (`pg_dumpall`
  comprimido con `zstd`, con fecha, retención de las últimas N copias) y `restore <fichero>`;
  más la documentación de cómo programarla (cron o timer de systemd de usuario) y de dónde
  dejarla (carpeta sincronizada o bucket con `rclone`). Cubre reviews, votos y estadísticas y
  también las bases `temporal` y `temporal_visibility` (workflows en vuelo).
- Configuración nueva del worker: `REVIEW_NOTES` (por defecto activo) y `REVIEW_NOTES_PUSH`
  (por defecto activo).
- Cambio de comandos del workflow `ReviewChangeWorkflow` bajo `workflow.patched("archive-reviews")`
  (ADR 0007); las historias grabadas existentes siguen reproduciéndose.

## Capabilities

### New Capabilities
- `review-notes`: copia duradera de cada review en el repositorio revisado como nota de git,
  escrita y empujada tras terminar los agentes, sin bloquear la revisión si no es posible.
- `data-backups`: copia de seguridad y restauración de la base de datos local (todas las bases
  del servidor), comprimida, con retención y programable.

### Modified Capabilities

## Impact

- Código: `application/ports.py` (puerto `ReviewArchive`), `application/review_notes.py`
  (JSON de la nota, lógica pura), `adapters/git/notes_archive.py` (`git notes` + `git push`),
  `workflows/activities.py` (activity `archive_reviews`), `workflows/dto.py`
  (`ArchiveReviewsInput`/`ArchiveReviewsResult`), `workflows/review_change.py` (parche),
  `worker.py` y `config.py` (registro y ajustes).
- `justfile` (`backup`, `restore`), `.gitignore` (`backups/`), `README.md` (operación),
  `docs/architecture.md`, `docs/testing.md`, `docs/temporal-buenas-practicas.md` (checklist:
  parche nuevo).
- Tests: unitarios de la nota y del adaptador (repositorio git temporal con remoto `bare`),
  integración del workflow (la activity corre tras las reviews; replays de historias previas
  en verde), configuración.
- Sin cambios en API, base de datos ni frontend. Reimportar notas a la base de datos queda
  fuera (non-goal): el camino de vuelta es el dump.
