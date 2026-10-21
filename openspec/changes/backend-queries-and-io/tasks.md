# Tasks

Cada tarea sigue TDD: primero el test en rojo (ejecutado y visto fallar por el motivo esperado),
después el código mínimo que lo pone en verde y, al final, el refactor con los tests en verde.

## 0. Medición antes

- [ ] 0.1 Antes de tocar código, en `tests/unit/application/test_local_projects.py`, un test de
      medición con el `GhPrSource` real y un `gh` falso en `PATH` (el mismo patrón `bin_dir` de
      `tests/unit/adapters/github/test_gh_cli.py`) que anota cada invocación en un fichero: 30 PRs
      abiertas, una primera sincronización las registra y en la segunda se cuentan las llamadas a
      `gh pr diff` y los `starter.start`. Anotar aquí el valor sobre el código actual (esperado:
      30 `gh pr diff` por ciclo). Ese mismo test pasa a afirmar 0 en la tarea 2.3.

## 1. Barrido acotado

- [ ] 1.1 Rojo (unit, `tests/unit/application/test_reachability.py`): `sweep_project` con
      `window=3` llama a `marks.tracked_commits(project.id, limit=3)` y a
      `history.reachable(..., limit=3)` (el mismo valor); el fake de `tests/fakes/commit_history.py`
      devuelve solo los `limit` más recientes por `(created_at, id)` descendente; un commit fuera de
      la lectura y ya no alcanzable no se marca ni emite evento. Verde: `limit` keyword obligatorio
      en el puerto `CommitMarks.tracked_commits`, en el fake y en `sweep_project`.
- [ ] 1.2 Rojo (integración, `tests/integration/persistence/test_commit_state.py`): con 4 commits
      del proyecto y `limit=3` devuelve los 3 más recientes; bordes `limit` = 2, 3 (= filas) y 5
      (> filas: todos); empate de `created_at` desempatado por `id` descendente; con
      `SET LOCAL enable_seqscan = off`, el `EXPLAIN` de la consulta nombra
      `ix_changes_project_kind_created_at_id`. Verde: `order_by(created_at.desc(), id.desc())` y
      `.limit(limit)` en `SqlAlchemyCommitMarks.tracked_commits`.

## 2. Sincronización de PRs

- [ ] 2.1 Rojo (unit, `tests/unit/adapters/github/test_gh_cli.py`, con el `gh` falso en
      `bin_dir`): `open_prs` solo ejecuta `gh pr list` (el script registra cada invocación) y las
      PRs no llevan diff; `pr_diff(root, 7)` ejecuta `gh pr diff 7` y recorta a `MAX_DIFF_CHARS`
      (bordes: `MAX_DIFF_CHARS` − 1, igual y + 1); los errores de sesión/plazo/ausencia siguen dando
      `GithubUnavailable`. Verde: partir `GhPrSource`, quitar `diff` de `PullRequestInfo`, actualizar
      el puerto `GithubPrSource` y `FakeGithubPrSource` (con `diffs_requested`).
- [ ] 2.2 Rojo (integración, `tests/integration/persistence`): `registered_heads(project, PR,
      [aaa, bbb, ccc])` con `aaa` registrada como `pr` y `bbb` como `commit` devuelve `{aaa}`; con
      otro proyecto o lista vacía devuelve vacío (la vacía sin consulta, con un espía de
      `session.execute`). Verde: método en `ChangeRepository` (puerto), en
      `SqlAlchemyChangeRepository` y en `FakeChangeRepository` (la tarea 4.1 lo pasa a
      `short_read`).
- [ ] 2.3 Rojo (unit, `test_local_projects.py`): el test de la tarea 0.1 afirma 0 `gh pr diff`,
      0 `starter.start` y `SyncResult(synced=30, created=0)`; con `FakeGithubPrSource`: escenario «PR con push nuevo» (`aaa`
      registrada pasa a `bbb`: un diff pedido para esa PR y `bbb` ingerida); mezcla de 3 PRs con 1
      nueva → 1 diff, `synced=3`, `created=1`; `registered_heads` se llama una vez por
      sincronización; una PR nueva con datos fuera de límites sigue descartándose sin tirar las
      demás. Verde: `sync_pull_requests(projects, changes, github, ingest_pr, slug)` y su cableado
      en `composition.py` (sesión propia por sincronización). Actualizar
      `tests/unit/entrypoints/test_local_projects_api.py` y `tests/e2e/test_local_projects_flow.py`
      si dependen de la firma.
- [ ] 2.4 Medición después: anotar aquí el resultado del test de 0.1 (esperado: 30 → 0 llamadas a
      `gh pr diff` por ciclo con 30 PRs sin cambios) para el informe del PR.

## 3. Reviews sin `raw_output` y recuento por estado

- [ ] 3.1 Rojo (integración, `tests/integration/persistence/test_sqlalchemy_review_repository.py`):
      `list_for_change` de un change con reviews con `raw_output` en dos runs devuelve todas con
      `raw_output is None` y la sentencia emitida (capturada con un listener
      `before_cursor_execute`) no contiene `raw_output`; `get` sigue devolviéndolo completo.
      Verde: `defer(ReviewModel.raw_output, raiseload=True)` y `review_from_row(...,
      with_raw_output=False)`; docstring del puerto.
- [ ] 3.2 Rojo (integración): `status_counts(change_id, run=2)` con reviews `completed`/`failed` en
      los runs 1 y 2 devuelve solo las del 2 (`{COMPLETED: 1, FAILED: 1}`); run sin reviews →
      `{}`; una sola sentencia con `GROUP BY`. Verde: método en `SqlAlchemyReviewRepository` y en el
      puerto `ReviewRepository`; `FakeReviewRepository.status_counts` sobre sus reviews (test unit
      del fake con los mismos casos).
- [ ] 3.3 Rojo (unit, `tests/unit/application/test_retry_review.py`): con un
      `FakeReviewRepository` espía, `retry_review` llama a `status_counts(change_id, change.run)`
      una vez y nunca a `list_for_change`; los escenarios «Run actual con un fallo» (acepta) y
      «Reviews de runs anteriores» (run 1 con dos `failed`, run 2 con dos `completed` → 409) y la
      matriz existente (`pending`, `running`, `completed`, `failed`, `partial_failed`) siguen en
      verde. Verde: `retry_review` usa `review_status_from_counts`.

## 4. Transacción del reintento

- [ ] 4.1 Rojo (integración, `tests/integration/persistence`): sobre una sesión real,
      `short_read` ejecutado fuera de transacción deja `session.in_transaction()` en `False` al
      terminar; dentro de un `session.begin()` abierto no lo cierra. Verde: helper
      `short_read` en `adapters/persistence/` usado por `SqlAlchemyChangeRepository.get`,
      `registered_heads` y `SqlAlchemyReviewRepository.status_counts`.
- [ ] 4.2 Rojo (integración, `tests/integration/application` o `persistence`): `retry_review` con
      repositorios SQLAlchemy sobre una sesión y un starter espía que registra
      `session.in_transaction()` al ser llamado → `False`, y después `run` avanza; con el starter
      fallando (`ReviewStartError`) el `run` no cambia y la sesión sigue sin transacción. Verde: lo
      da 4.1; ajustar si alguna lectura previa del caso de uso no pasa por `short_read`.

## 5. Salida acotada de `run_command`

- [ ] 5.1 Rojo (unit, `tests/unit/adapters/test_subprocess_runner.py`): escenario «Proceso
      desbocado» (`max_output_bytes=1000`, un programa que escribe 10 000 bytes en stdout y luego
      duerme 60 s) → como mucho 1000 bytes, `truncated`, el proceso ya no existe
      (`os.kill(pid, 0)` lanza) y la llamada tarda mucho menos que el plazo; lo mismo por stderr;
      bytes retenidos con un proceso que emite 10 × `max_output_bytes` por ambos (espía sobre el
      lector) ≤ `2 × max_output_bytes` + `CHUNK_BYTES`; bordes: exactamente el límite → no
      recortado ni matado, límite + 1 → recortado; con `input` grande y salida desbocada no se
      cuelga. Los tests existentes (plazo, cancelación, descendiente desasociado, stdin cerrado)
      siguen en verde. Verde: recogida por bloques, `_kill_group` al superar el límite y
      `_reap_after_kill` generalizado.
- [ ] 5.2 Rojo (unit, `test_gh_cli.py`): un `gh pr diff` cuyo resultado llega con `truncated` y
      `returncode` −9 devuelve el diff recortado, no `GithubUnavailable`; un `gh pr list`
      recortado sigue dando `GithubUnavailable`. Verde: `_gh` mira `truncated` antes que
      `returncode`.

## 6. Índice de eventos

- [ ] 6.1 Rojo (integración, `test_migrations.py`): tras `upgrade head` existe
      `ix_events_project_id` sobre `events(project_id)` (consulta a `pg_indexes`); tras
      `downgrade -1` no existe y las filas siguen; el test de deriva modelo/migraciones falla hasta
      declarar el índice en el modelo. Verde: migración nueva sobre `j0b8c2e6f459` con
      `create_index`/`drop_index` e `Index("ix_events_project_id", "project_id")` en
      `EventModel.__table_args__`.

## 7. Starter sin consultas repetidas

- [ ] 7.1 Rojo (unit, `test_ingest_pr.py` y los de `ingest_commit`): `FakeReviewStarter` registra
      `project_slug` y `agent_names`; ingerir un commit y una PR pasa `project.slug` y
      `project.agents` (y los configurados si el proyecto no tiene selección); la PR que reutiliza
      reviews sigue sin arrancar. Verde: nueva firma de `ReviewStarter.start` y `_ingest`.
- [ ] 7.2 Rojo (unit, `test_retry_review.py`): con un `FakeProjectRepository` espía, `retry_review`
      llama a `projects.get` una vez y nunca a `agents_of`; pasa al starter el slug y los agentes
      del proyecto; `advance_run` recibe `expected_agents = len(agents)`; un change con
      `expected_agents = None` se juzga con `len(agents)`; con `expected_agents=1` y selección de 2
      un change `completed` sigue dando `RetryNotAllowed`; proyecto inexistente → `ChangeNotFound`.
      Verde: `ProjectRepository.get(project_id)` (puerto, `SqlAlchemyProjectRepository` con
      sesión propia, fake) y la nueva firma de `retry_review`; `composition.py` pasa
      `settings.agent_names`.
- [ ] 7.3 Rojo (integración, `tests/integration/orchestration/test_temporal_review_starter.py` y
      `test_readable_names.py`): `TemporalReviewStarter(client).start(change, project_slug=...,
      agent_names=...)` arranca el workflow con ese slug en el id y esos agentes en la entrada; el
      constructor ya no acepta repositorios (no hay acceso a la base de datos que espiar). Verde:
      quitar `agent_names`, `slugs`, `project_agents`, `_slug_of` y `_agents_of` del adaptador;
      actualizar `composition.py`.

## 8. URL de la base de datos

- [ ] 8.1 Rojo: `tests/unit/adapters/test_db_config.py` — `create_engine()` sin URL es un
      `TypeError` y con URL explícita la usa; se borran los tests de `get_database_url`. En
      `tests/unit`, un test de `alembic/env.py::get_url` con `DATABASE_URL` fijado devuelve ese
      valor sin `INGEST_TOKEN` en el entorno. Verde: borrar `get_database_url`, `database_url`
      obligatorio en `create_engine`, `get_url` devuelve `WorkerSettings().database_url`. Los
      tests de migración e integración siguen en verde con su `DATABASE_URL` de testcontainers.

## 9. Mutation testing

- [ ] 9.1 Mutation testing acotado al diff: `mutmut` solo sobre las funciones de `domain/` y
      `application/` modificadas (`application/reachability.py`, `application/local_projects.py`,
      `application/ingest_commit.py`, `application/retry_review.py`), sin tocar el `source_paths`
      del proyecto en el commit. Objetivo > 95 %; abortar si pasa de 3 minutos; anotar aquí y en
      el PR el resultado y justificar cada mutante superviviente. Los cambios en `adapters/`
      (`subprocess_runner`, `gh_cli`, persistencia, starter) quedan fuera de la configuración de
      `mutmut` del proyecto (necesitan Postgres, Temporal o procesos reales): se justifica y se
      cubre con los bordes de las tareas 1.2, 2.1, 3.1, 3.2, 5.1 y 5.2.

## 10. Verificación final

- [ ] 10.1 `just lint`, `just typecheck` y `just test-unit` en verde.
- [ ] 10.2 `just test-integration` en verde si hay Podman/Docker; si no, dejarlo indicado.
- [ ] 10.3 En `frontend/`: `pnpm test` y `pnpm build` en verde.
- [ ] 10.4 `docs/openapi.json` sin cambios (contrato intacto), la medición 30 → 0 anotada en 2.4 y
      commits atómicos por bloque.
