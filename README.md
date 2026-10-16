<div align="center">

<picture>
  <source media="(prefers-color-scheme: dark)" srcset="frontend/src/assets/brand/mark-dark-128.png">
  <img src="frontend/src/assets/brand/mark-light-128.png" alt="Logo de Duelo" width="120">
</picture>

# Duelo

**Claude Code y Codex revisan cada commit de tus repos; tú comparas quién lo hace mejor.**

Cada repositorio vigilado es un canal al estilo Slack. Cada commit o PR dispara una review en
paralelo de los dos agentes, con tu propia sesión de CLI y sin claves de API, y una página de
estadísticas los compara con datos de tu código. Todo corre en tu máquina.

![Python](https://img.shields.io/badge/Python-3.12-3776AB?logo=python&logoColor=white)
![FastAPI](https://img.shields.io/badge/FastAPI-async-009688?logo=fastapi&logoColor=white)
![Temporal](https://img.shields.io/badge/Temporal-workflows-000000?logo=temporal&logoColor=white)
![PostgreSQL](https://img.shields.io/badge/PostgreSQL-16-4169E1?logo=postgresql&logoColor=white)
![React](https://img.shields.io/badge/React-19-61DAFB?logo=react&logoColor=white)
![TypeScript](https://img.shields.io/badge/TypeScript-6-3178C6?logo=typescript&logoColor=white)
![Vite](https://img.shields.io/badge/Vite-8-646CFF?logo=vite&logoColor=white)
![CI](https://github.com/RenzoRamosDEV/Duelo/actions/workflows/ci.yml/badge.svg)
![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)

</div>

---

## Qué es

Los agentes de código revisan commits cada vez mejor, pero **no hay forma de saber cuál lo hace
mejor con tu código**: cada uno vive en su terminal, con su formato y sin memoria de lo que dijo
el otro. Duelo pone a Claude Code y a Codex a revisar **el mismo cambio, a la vez y con el mismo
criterio**, y guarda las dos respuestas una al lado de la otra.

**Duelo es una aplicación web local, para un solo usuario.** Un hook de git avisa a la API de
cada commit o push, Temporal orquesta las reviews, y el frontend las enseña por canal, con los
hallazgos de cada agente y su nota. Los agentes son los CLI que ya tienes instalados:

- **Con tu suscripción, sin claves de API** — el worker de agentes corre en tu máquina, donde
  `claude` y `codex` ya tienen la sesión iniciada. Nada de `ANTHROPIC_API_KEY` ni `OPENAI_API_KEY`.
- **Solo lectura y confinados** — ningún agente puede editar, ejecutar comandos ni salir a la red.
  Claude lee el repo para dar contexto; Codex revisa solo el diff.
- **El mismo revisor para los dos** — el criterio vive en [`Agents/code-guardian/`](Agents/code-guardian/)
  (un `AGENT.md` versionado y una skill por tema); el backend compone el prompt con las skills
  que tocan a cada diff.
- **Nada se pierde** — cada review queda en Postgres, en el historial de Temporal y como nota de
  git del propio commit (`refs/notes/duelo`), y `just backup` vuelca la base entera.

Es un proyecto personal de portafolio, construido por fases con [OpenSpec](https://openspec.dev/)
sobre el spec de [`docs/spec/duelo.md`](docs/spec/duelo.md). Aún faltan piezas del plan: el voto
ciego entre reviews, la review de PRs por webhook con *debounce*, responder a `@claude` en el
hilo y el modo demo público.

## Para qué sirve

- **Ver qué dijo cada agente de cada commit** — resumen, nota de 0 a 10 y hallazgos con
  severidad, fichero y línea, en el canal del repo y en el detalle del cambio.
- **Comparar agentes con tus datos** — la página de estadísticas da por agente la nota media,
  la duración media y cuántas reviews completó o falló, globales o por proyecto.
- **Elegir quién revisa cada proyecto** — Claude, Codex o los dos, desde Ajustes.
- **No gastar dos veces** — una PR idéntica a un commit ya revisado reutiliza sus reviews; un
  commit deshecho o revertido se marca, no se borra.
- **Seguir una review por dentro** — cada commit es un workflow de Temporal con nombre legible,
  y lo que respondió cada revisor se lee en la Temporal UI sin abrir la base de datos.

---

## Cómo está montado

```
 git commit / git push                  navegador (React + TS)
        │ hook post-commit / pre-push           │ VITE_API_URL
        ▼                                       ▼
 ┌─────────────────────────────────────────────────────────┐
 │  API (FastAPI)   ingesta · proyectos · canal · stats     │
 └───────────┬─────────────────────────────┬───────────────┘
             │ change + evento (outbox)    │ arranca workflow
             ▼                             ▼
      Postgres 16  ◀──────────────▶  Temporal (+ UI)
             ▲                             │ task queues `platform` y `agents`
             │ reviews, notas, backups     ▼
 ┌─────────────────────────────────────────────────────────┐
 │  Worker en TU máquina:  claude  ·  codex  (solo lectura) │
 └─────────────────────────────────────────────────────────┘
```

- **Monolito hexagonal** en `backend/src/duelo/`: `domain` ← `application` ← `adapters` /
  `entrypoints` / `workflows`, con la regla de dependencias vigilada por `import-linter`.
  Postgres, Temporal, FastAPI y cada agente son adaptadores detrás de un puerto.
- **Tres procesos**: la API, el worker `platform` (contenedor) y el worker `agents`, que corre
  siempre fuera de Docker porque ahí están los CLI con tu sesión. En desarrollo `just worker`
  levanta los dos workers en un proceso.
- **Un workflow por commit** (`commit-{repo}-{sha}-{proyecto}`) con un hijo por *run* de review.
  A Temporal solo viajan ids y un extracto acotado de cada respuesta, nunca el diff ni la salida
  cruda del CLI; antes de entrar en el historial, el texto pasa por una redacción de credenciales.
- **Outbox**: cada cambio de estado escribe su evento en la misma transacción, y
  `GET /changes/{id}/events` los sirve con una lista blanca de campos. El frontend refresca las
  páginas en vivo por sondeo cada 5 s; el SSE con reenganche sigue en el plan.
- **Un criterio, muchas skills**: `Agents/code-guardian/AGENT.md` declara las skills que entran
  siempre (`bug-detection`, `security-audit`, `safe-refactoring`, `test-coverage`,
  `change-hygiene`, `finding-verification`, `review-report`); las demás llevan `paths` y entran
  solo si algún fichero del diff casa (`architecture-review`, `data-and-api-contracts`,
  `dependency-and-config-audit`, `frontend-review`, `performance-review`, `temporal-review`).
  Cambiar el criterio exige subir `version` en `AGENT.md`.

Detalle en [`docs/architecture.md`](docs/architecture.md), las decisiones en
[`docs/adr/`](docs/adr/) y una **guía interactiva** del flujo de punta a punta, con simulador,
en [`docs/flujo-duelo.html`](docs/flujo-duelo.html) (un solo archivo: ábrelo en el navegador).

---

## Qué usa

| Capa | Tecnología | Por qué |
| --- | --- | --- |
| API | **FastAPI** + Pydantic | Contrato OpenAPI versionado en `docs/openapi.json`, del que se generan los tipos TypeScript del frontend; CI falla si cualquiera de los dos deriva |
| Persistencia | **PostgreSQL 16**, SQLAlchemy 2 async, Alembic | Transacciones con outbox e idempotencia por clave natural |
| Orquestación | **Temporal** (`temporalio`) | Reintentos, latidos, compensación y reintento de reviews sin perder estado ([ADR 0001](docs/adr/0001-temporal-vs-alternativas.md)) |
| Agentes | CLI de **Claude Code** y **Codex** | Con tu sesión, confinados a solo lectura; `FakeAgent` para tests y demo |
| Frontend | **React 19 + TypeScript + Vite**, React Router | Canal por proyecto, detalle por commit, PWA instalable con tema claro y oscuro |
| Tooling | `uv`, `pnpm`, `just`, Docker Compose | Un comando para levantar y otro para reproducir el CI |
| Calidad | Ruff, mypy strict, Biome, import-linter, gitleaks, mutation testing | `just ci` reproduce en local lo que corre en GitHub Actions |
| Especificación | **OpenSpec** | Cada cambio se describe antes de implementarse (`openspec/`) |

---

## Puesta en marcha

Requisitos:

- [`uv`](https://docs.astral.sh/uv/) (instala Python 3.12 solo)
- Node.js 22+ con `pnpm` (`corepack enable pnpm`)
- [`just`](https://github.com/casey/just)
- `docker` + `docker compose`, o `podman` + `podman-compose` (el `justfile` usa `podman-compose`;
  cambia la variable `compose` si usas Docker)
- [`pre-commit`](https://pre-commit.com/) y [`gitleaks`](https://github.com/gitleaks/gitleaks)
  para los hooks de calidad

```bash
pre-commit install                        # hooks de git: ruff, mypy, import-linter, biome, tsc, gitleaks
export INGEST_TOKEN=dev-ingest-token      # solo desarrollo local
just dev                                  # Postgres + Temporal + Temporal UI + API (localhost:8000)
just migrate                              # esquema de la base de datos
just worker                               # worker, en otra terminal (agentes de prueba por defecto)
cd frontend && pnpm install && VITE_API_URL=http://localhost:8000 pnpm dev   # localhost:5173
```

Sin `VITE_API_URL` el frontend enseña datos de ejemplo. El token de ingesta se pega en Ajustes y
vive solo en memoria de la pestaña. La Temporal UI queda en `localhost:8080`.

### Un primer commit a mano

Los proyectos se dan de alta desde una carpeta local (ver más abajo); para probar la ingesta sin
repo basta con una fila en la base:

```bash
podman exec -i duelo_postgres_1 psql -U duelo -c \
  "insert into projects(id, slug) values (gen_random_uuid(), 'demo/repo')"
curl -i -X POST localhost:8000/ingest/commit \
  -H "X-Ingest-Token: $INGEST_TOKEN" -H 'content-type: application/json' \
  -d '{"project":"demo/repo","ref":"refs/heads/main","head_sha":"abc123","title":"t","author":"yo","diff":"d"}'
# -> 202 con el change_id; en la Temporal UI aparece commit-demo-repo-abc123-<proyecto6>
curl localhost:8000/ready                 # 200 solo si Postgres y Temporal responden
```

La API escucha solo en `127.0.0.1`; `INGEST_TOKEN` es un secreto compartido entre la API, el
worker y los hooks.

---

## Revisar con Claude Code y Codex

Por defecto `AGENT_NAMES=agent_1,agent_2`: agentes de prueba (`FakeAgent`) que devuelven siempre
la misma review. Para que revisen los CLI **reales**, arranca la API **y** el worker con la misma
lista:

```bash
export AGENT_NAMES=claude,codex          # en la API y en el worker
just worker                              # en TU máquina: ahí están los CLI con la sesión iniciada
```

`AGENT_NAMES` es el conjunto de agentes **disponibles**; desde Ajustes (o con
`PUT /projects/{slug}/agents`) eliges por proyecto cuáles lo evalúan, siempre al menos uno. Aplica
a los commits que lleguen después. No admite nombres repetidos, tampoco si solo cambian las
mayúsculas: la API y el worker no arrancan y el error nombra el repetido.

Garantías y límites:

- **Sesión, no claves.** `claude` y `codex` instalados y con sesión iniciada. Sin sesión o fuera
  del `PATH`, la review queda `failed` con un mensaje claro y se puede reintentar. Al proceso del
  CLI no llegan `INGEST_TOKEN`, `OPERATOR_TOKEN`, `DATABASE_URL` ni tus claves de API.
- **Solo lectura.** Claude Code recibe únicamente `Read`, `Grep` y `Glob`, en modo `--restricted`
  y sin poder pedir permisos. Codex corre con el sandbox `read-only`, sin tu configuración y con
  30 funciones desactivadas (todo lo que ejecuta comandos, lee el disco, lanza subagentes o usa
  red, plugins o MCP). Ninguno carga tus MCP ni tus hooks.
- **Qué ve cada uno.** Claude lee la carpeta del proyecto si se añadió desde una carpeta local;
  si no, un directorio temporal vacío. Codex revisa **solo el diff** en un directorio vacío: no se
  le expone tu repositorio.
- **El diff es dato, no instrucción.** Viaja por la entrada estándar (hasta 60 000 caracteres) y
  el prompt ordena ignorar cualquier instrucción que contenga.
- **Riesgo residual de Codex.** La defensa es una lista de denegación más el sandbox. Cada función
  de `codex features list` está clasificada en el código y un test falla, nombrándola, si una
  versión nueva trae una sin clasificar (`tests/integration/agents/test_codex_features.py`). Tras
  vencer el plazo, un proceso que el CLI dejara en otra sesión no se mata: solo se deja de esperar.
- **Consumo.** Cada review gasta tu suscripción (un diff diminuto: ≈ 0,03 USD de lista en Claude y
  ≈ 13 000 tokens en Codex). `AGENT_MAX_CONCURRENCY` limita cuántos CLI corren a la vez.
- La calidad depende del modelo: la nota y los hallazgos no se verifican contra el código.

| Variable (worker) | Por defecto | Qué hace |
| --- | --- | --- |
| `AGENT_NAMES` | `agent_1,agent_2` | Agentes disponibles. `claude` y `codex` usan los CLI reales; cualquier otro nombre, el agente de prueba |
| `AGENT_TIMEOUT_SECONDS` | `240` | Plazo de cada ejecución del CLI. Máximo 270: la activity dura 5 minutos y se reservan 30 s para guardar la review fallida |
| `AGENT_MAX_CONCURRENCY` | `2` | CLI simultáneos en este worker; el resto espera en la cola de Temporal |
| `CLAUDE_BIN` / `CODEX_BIN` | en el `PATH` | Ruta del ejecutable si no está en el `PATH` |
| `CLAUDE_MODEL` / `CODEX_MODEL` | el del CLI | Modelo a usar |
| `CLAUDE_MAX_BUDGET_USD` | `2` | Tope de gasto (USD de lista) de una ejecución de Claude Code |
| `REVIEW_NOTES` / `REVIEW_NOTES_PUSH` | `true` / `true` | Escribir la nota de git de cada review y empujarla a `origin` |

---

## Proyectos desde carpetas locales

Con la API corriendo **en tu máquina** (no en el contenedor) y `LOCAL_PROJECTS_ENABLED=true`,
puedes dar de alta un repo por su ruta y Duelo instala los hooks `post-commit` y `pre-push`:

```bash
export INGEST_TOKEN=dev-ingest-token LOCAL_PROJECTS_ENABLED=true INGEST_URL=http://127.0.0.1:8001
cd backend && uv run uvicorn --factory duelo.composition:create_app_from_env --port 8001
curl -X POST localhost:8001/projects -H "X-Ingest-Token: $INGEST_TOKEN" \
  -H 'content-type: application/json' -d '{"path": "/ruta/absoluta/a/tu/repo"}'
# a partir de ahora cada commit y push de ese repo aparece solo en su canal
curl -X POST localhost:8001/projects/owner/repo/sync-prs -H "X-Ingest-Token: $INGEST_TOKEN"  # PRs con `gh`
curl -X DELETE localhost:8001/projects/owner/repo -H "X-Ingest-Token: $INGEST_TOKEN"        # baja y quita los hooks
```

Los hooks **no bloquean ni retrasan** `git commit` ni `git push`: envían en segundo plano y salen
con 0 aunque la API esté caída. Respetan tus propios hooks (Duelo solo añade un bloque entre
`# >>> duelo >>>` y `# <<< duelo <<<`, que la baja retira) y leen la URL y el token **solo** de
`~/.config/duelo/hook.env` (0600), nunca del repo ni del entorno. Quien tenga el token puede hacer
que la API escriba hooks en tus repos: no actives esto en un servidor compartido ni expongas la API.

**Un commit y su PR no se revisan dos veces.** Una PR con el mismo SHA y el mismo diff que un
commit ya revisado por todos los agentes nace con esas reviews copiadas («Reutilizada del commit
abc1234») y no arranca ningún workflow. Si el commit aún se revisa, falta un agente, falló alguno
o la PR tiene otro diff, se revisa con normalidad.

**Commits deshechos y revertidos.** Si deshaces un commit, Duelo lo marca en ámbar y no borra
nada (`commit_state` = `active`, `discarded` o `reverted` en la API):

- **Deshecho** («Ya no está en la rama»): su SHA ya no es alcanzable desde ninguna referencia
  (`reset`, `--amend`, `rebase`, borrar la rama). La API lo comprueba cada
  `REACHABILITY_SWEEP_INTERVAL_SECONDS` con una llamada a `git log --all` por proyecto. Si el
  commit vuelve, se desmarca solo.
- **Revertido** («Revertido por `abc1234`»): otro commit lo invierte con `git revert`. Solo se
  reconoce el formato que escribe git (`Revert "…"` y la línea `This reverts commit <sha>.`); no se
  comprueba que el parche sea de verdad el inverso.

Si está deshecho **y** revertido, gana «deshecho». Una PR nunca está deshecha ni revertida. Los
proyectos sin carpeta local no se evalúan.

---

## Seguir una review en Temporal

Cada commit o PR es un workflow con nombre legible, `commit-acme-widgets-3f2a9c1b7d4e-ab12cd` (o
`pr-…`), y un hijo `review-…-r1` por *run* (`-r2` si se reintenta). El último trozo es el inicio del
UUID del proyecto: quitar un proyecto y volver a añadirlo no hace que Temporal ignore un commit
repetido. Para filtrar un repo en la UI: `WorkflowId STARTS_WITH "commit-acme-widgets"`.

Lo que respondió cada revisor se lee en la Temporal UI, sin ir a la base de datos:

- **Result** del `review-…` lista, por agente, resumen, nota y hallazgos, y si falló, el error
  saneado. Va acotado (resumen ≤ 2000 caracteres, ≤ 30 hallazgos; `truncated` avisa si se cortó)
  y nunca lleva el diff ni la salida cruda del CLI.
- **Current Details** muestra una línea por agente según terminan («✅ claude · completada ·
  7/10 · 3 hallazgos…», «⏳ codex · revisando…»).
- **Summary & Details** del workflow y el resumen de cada actividad salen en la línea de tiempo.

El historial de Temporal es inmutable, así que todo texto libre pasa antes por una redacción de
credenciales (`token=…`, `Authorization: Bearer …`, `sk-…`, tokens de GitHub, claves de AWS, Slack,
JWT y claves privadas). Es heurística, no garantía: una contraseña en prosa no se detecta. La
tabla `reviews` y la API guardan el texto original.

Esos paneles necesitan un Temporal reciente: el `docker-compose.yml` fija `auto-setup:1.26.2` y
`ui:2.36.1` (el servidor 1.24 los descarta y la UI 2.31 no los pinta). Si tenías el stack
levantado con versiones viejas, `just down && just dev` lo recrea; el volumen de Postgres se
conserva y los workflows anteriores siguen ahí.

---

## Configuración de la API

| Variable | Por defecto | Qué hace |
| --- | --- | --- |
| `INGEST_TOKEN` | (obligatoria) | Token de ingesta, de alta y baja de proyectos y de reintento de reviews |
| `OPERATOR_TOKEN` | sin configurar | Descarga de la salida cruda de una review (`X-Operator-Token`); distinto de `INGEST_TOKEN`, 16+ caracteres |
| `MAX_INGEST_BODY_BYTES` | `1500000` | Tamaño máximo del cuerpo de `POST /ingest/*` (413 si lo supera); el diff además se trunca a `MAX_DIFF_CHARS` (`200000`) |
| `ALLOWED_ORIGINS` | vacía (sin CORS) | Orígenes del navegador permitidos, separados por comas; no admite `*` |
| `RATE_LIMIT_REQUESTS` / `RATE_LIMIT_WINDOW_SECONDS` | `300` / `60` | Límite por IP de `POST /ingest/*` y `/changes/{id}/retry` (429 con `Retry-After`); `0` lo desactiva. En memoria de un proceso |
| `STALE_AFTER_SECONDS` | `1800` | Un change `pending`/`running` cuyo *run* actual empezó hace más se marca `stale` (solo diagnóstico) |
| `LOCAL_PROJECTS_ENABLED` | `false` | Alta de proyectos desde carpetas locales con hooks de git. Solo con la API en tu máquina; apagado, esos endpoints dan 404 |
| `INGEST_URL` | `http://127.0.0.1:8000` | Dónde envían los hooks los commits |
| `HOOK_ENV_PATH` | `~/.config/duelo/hook.env` | Fichero 0600 con la URL y el token que leen los hooks |
| `PR_SYNC_INTERVAL_SECONDS` | `0` | Sincronización periódica de PRs con `gh` (`0` = solo bajo demanda) |
| `REACHABILITY_SWEEP_INTERVAL_SECONDS` | `15` | Cada cuántos segundos se comprueba qué commits siguen en su repo; `0` lo apaga. Solo con `LOCAL_PROJECTS_ENABLED` |
| `REACHABILITY_WINDOW_COMMITS` | `5000` | Cuántos commits recientes se piden a git en cada barrido (1 a 100 000) |

Cada respuesta lleva `X-Request-ID` (se propaga el entrante si es válido) y la API escribe un
access log JSON por petición en stdout, sin query, cuerpo ni tokens. El contrato completo está en
[`docs/openapi.json`](docs/openapi.json).

---

## Que no se pierda lo ya evaluado

Las reviews y las estadísticas viven en el Postgres de `docker-compose.yml` (volumen
`postgres_data`), y Temporal guarda ahí mismo sus workflows. Dos mecanismos evitan que una
evaluación dependa de ese volumen:

**Nota de git por commit.** Al terminar los agentes, el worker escribe en el repositorio local del
proyecto una nota en `refs/notes/duelo` con el JSON de las reviews de esa *run* (resumen, nota,
hallazgos, duración, error; nunca la salida cruda) y la empuja a `origin` con tu credencial de git.
Nunca pide contraseña: sin credencial no interactiva, la nota queda en local. Si el proyecto no
tiene carpeta local o el commit no está en ella, se omite y la review termina igual.

```bash
git notes --ref=duelo show <sha>                      # leer la nota de un commit
git fetch origin refs/notes/duelo:refs/notes/duelo    # traerlas en otra máquina
git log --notes=duelo -1 <sha>                        # verla junto al commit
```

**Copia de la base de datos.** `just backup` vuelca todas las bases del servidor (`duelo`,
`temporal`, `temporal_visibility`) con `pg_dumpall`, comprime con `zstd` y deja
`backups/duelo-<fecha>.sql.zst`, conservando las últimas 14 (`just backup backups 30` para más).
Requiere `zstd` y la infra arriba. Trátala como privada: incluye los roles del servidor. Para que
no viva solo en esta máquina, prográmala y sácala fuera:

```bash
# cron: cada día a las 03:00
0 3 * * * cd /ruta/a/Duelo && just backup >/dev/null 2>&1 && rclone sync backups/ remoto:duelo-backups
```

```ini
# systemd de usuario: ~/.config/systemd/user/duelo-backup.service y .timer
[Service]
Type=oneshot
WorkingDirectory=/ruta/a/Duelo
ExecStart=/usr/bin/just backup

[Timer]
OnCalendar=daily
Persistent=true
```

(`systemctl --user enable --now duelo-backup.timer`; `loginctl enable-linger $USER` para que corra
sin sesión abierta.) Para restaurar, parte de un volumen vacío y con solo Postgres arriba, porque la
copia reemplaza también las bases de Temporal:

```bash
just down && podman volume rm duelo_postgres_data
podman-compose --profile infra up -d postgres
just restore backups/duelo-<fecha>.sql.zst   # se niega si la base ya tiene datos o Temporal corre
just dev
```

---

## Comandos

| Comando | Qué hace |
| --- | --- |
| `just dev` / `just down` | Levanta o para infra (perfil `infra`) + API (perfil `app`) |
| `just migrate` | Aplica las migraciones de Alembic |
| `just worker` | Worker de desarrollo (`platform` + `agents`); `AGENT_NAMES=claude,codex` usa los CLI |
| `just test-unit` | Tests unitarios: sin Docker, sin red, segundos |
| `just test-integration` | Postgres real (testcontainers) y Temporal de test |
| `just test` | Toda la suite con cobertura y umbrales (97 % global, 100 % en `domain` + `application`), más los tests (Vitest) y el build del frontend |
| `just lint` | Ruff, mypy strict, import-linter y Biome, sin tocar nada |
| `just format` | Formatea todo el repo: Ruff (con arreglos seguros) y Biome |
| `just typecheck` | Tipos de todo el repo: mypy strict y `tsc` |
| `just ci` | `lint` + `typecheck` + `test` + validación del compose: lo mismo que GitHub Actions, salvo gitleaks, osv-scanner, hadolint y commitlint |
| `just mutation` | Mutation testing sobre `domain/` y `application/`; falla por debajo del 95 % |
| `just openapi` | Regenera el snapshot `docs/openapi.json` tras un cambio deliberado de la API, y con él los tipos del frontend |
| `just gen-client` | Regenera solo `frontend/src/lib/api.generated.ts` (`openapi-typescript`) desde el snapshot |
| `just load` | Carga ligera de `POST /ingest/commit` |
| `just backup` / `just restore f` | Copia de todas las bases del Postgres local y su restauración |
| `pnpm test` (en `frontend/`) | Solo los tests del frontend (Vitest); `just test` ya los incluye |

---

## Desarrollo

Proyecto personal; estas notas mantienen la disciplina del repo entre sesiones.

- **Todo cambio va como change de OpenSpec**, también mejoras, tests y tooling: nunca un commit
  suelto. Cada change vive en `openspec/changes/<nombre>/` con `proposal.md`, `design.md`,
  `specs/<capacidad>/spec.md` y `tasks.md`; al cerrarlo, `openspec archive <nombre>` mueve el delta
  a `openspec/specs/` (el comportamiento activo del sistema) y lo archiva.
- **No saltar de fase.** `openspec/config.yaml` fija el plan de siete fases del spec; un change no
  implementa capacidades de una fase posterior «ya que estamos».
- **Antes de un push, `just ci`.** Conventional Commits (`feat:`, `fix:`, `docs:`...), que
  `commitlint` exige en CI. Cada decisión importante va como ADR en `docs/adr/NNNN-slug.md`,
  enlazado desde `docs/architecture.md`.
- **Solo tests que aportan.** La estrategia, las capas y qué se difiere y por qué están en
  [`docs/testing.md`](docs/testing.md). La calidad se mide con mutation testing, no con cobertura.
- **La revisión de código es cosa del producto.** El criterio vive en `Agents/code-guardian/`, no
  en `.claude/`, donde solo quedan las skills de OpenSpec.
- [`docs/temporal-buenas-practicas.md`](docs/temporal-buenas-practicas.md) recoge cómo se operan
  los workers, y [`docs/postmortems/`](docs/postmortems/) los incidentes y lo aprendido.

Cada push y PR corre en GitHub Actions lint y tests del backend, Biome, tests y build del
frontend, gitleaks, validación del compose y del Dockerfile, build de la imagen, commitlint y
osv-scanner; el mutation testing corre semanalmente. Ver [`SECURITY.md`](SECURITY.md).

---

## Licencia

[MIT](LICENSE) © Renzo Ramos
