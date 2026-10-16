compose := "podman-compose"

# Levanta infra (Postgres, Temporal, Temporal UI) + API y espera a que /health responda
dev:
    {{compose}} --profile infra --profile app up -d --build
    @echo "Esperando a que la API responda en /health..."
    @for _ in $(seq 1 30); do \
        curl -sf http://localhost:8000/health > /dev/null && echo "API lista." && exit 0; \
        sleep 1; \
    done; \
    echo "La API no respondió a tiempo." >&2; exit 1

# Para y limpia los contenedores levantados por `just dev`
down:
    {{compose}} --profile infra --profile app down

# Aplica las migraciones de Alembic a la base de datos local (DATABASE_URL o la de compose)
migrate:
    cd backend && uv run alembic upgrade head

# Worker de desarrollo (task queues platform y agents, con FakeAgent) contra la infra local
worker:
    cd backend && uv run python -m duelo.worker

# Trátala como privada: lleva los roles y contraseñas (de desarrollo) del servidor.
# Copia de todas las bases del Postgres local (duelo + Temporal) en <dir>/duelo-<fecha>.sql.zst; conserva <keep> copias
backup dir="backups" keep="14":
    #!/usr/bin/env bash
    set -euo pipefail
    if ! podman ps --format '{{{{.Names}}' | grep -qx duelo_postgres_1; then
        echo "backup: el contenedor duelo_postgres_1 no está en marcha (just dev)" >&2; exit 1
    fi
    command -v zstd >/dev/null || { echo "backup: falta zstd" >&2; exit 1; }
    mkdir -p "{{dir}}"
    file="{{dir}}/duelo-$(date +%Y%m%d-%H%M%S).sql.zst"
    podman exec duelo_postgres_1 pg_dumpall -U duelo --clean --if-exists | zstd -q -o "$file"
    echo "backup: $file ($(du -h "$file" | cut -f1))"
    ls -1 "{{dir}}"/duelo-*.sql.zst | sort | head -n -{{keep}} | while read -r old; do
        rm -f "$old" && echo "backup: borrada $old"
    done

# Solo sobre un volumen vacío y con Temporal parado: just down && podman volume rm duelo_postgres_data
# && podman-compose --profile infra up -d postgres && just restore <fichero> && just dev
# Restaura una copia de `just backup` en el Postgres local (solo sobre una base vacía, con Temporal parado)
restore file:
    #!/usr/bin/env bash
    set -euo pipefail
    if ! podman ps --format '{{{{.Names}}' | grep -qx duelo_postgres_1; then
        echo "restore: el contenedor duelo_postgres_1 no está en marcha (just dev)" >&2; exit 1
    fi
    [ -f "{{file}}" ] || { echo "restore: no existe {{file}}" >&2; exit 1; }
    if podman ps --format '{{{{.Names}}' | grep -qE '^duelo_temporal(-ui)?_1$'; then
        echo "restore: para Temporal antes (podman-compose --profile infra stop temporal temporal-ui):" \
             "la copia reemplaza sus bases y no se pueden borrar mientras esté conectado" >&2; exit 1
    fi
    # Por TCP: el servidor temporal de la inicialización del contenedor solo escucha en el socket,
    # así que esto no responde hasta que el servidor definitivo está arriba con la base creada.
    for _ in $(seq 1 60); do
        podman exec duelo_postgres_1 psql -h 127.0.0.1 -U duelo -d postgres -Atc "select 1" >/dev/null 2>&1 && break
        sleep 1
    done
    rows=$(podman exec duelo_postgres_1 psql -h 127.0.0.1 -U duelo -d duelo -Atc \
        "select count(*) from changes" 2>/dev/null || echo 0)
    if [ "$rows" != "0" ]; then
        echo "restore: la base duelo ya tiene $rows changes; restaura sobre un volumen vacío" >&2; exit 1
    fi
    # El dump lleva `DROP/CREATE/ALTER ROLE duelo`: es el rol con el que nos conectamos (lo crea el
    # contenedor) y Postgres no deja borrarlo; el resto del dump se aplica tal cual.
    zstd -dc "{{file}}" | grep -vE '^(DROP ROLE( IF EXISTS)?|CREATE ROLE|ALTER ROLE) duelo( |;)' \
        | podman exec -i duelo_postgres_1 psql -h 127.0.0.1 -U duelo -d postgres -q -v ON_ERROR_STOP=1
    echo "restore: {{file}} cargada; reinicia la API y el worker (just down && just dev)"

# Regenera el snapshot del contrato (docs/openapi.json) tras un cambio deliberado de la API
openapi:
    cd backend && PYTHONPATH=. uv run python ../scripts/dump_openapi.py

# Carga ligera de POST /ingest/commit (bajo demanda; requiere API + worker + infra arriba)
load *args:
    cd backend && uv run python ../scripts/load_ingest.py {{args}}

# Tests unitarios: sin Docker, sin red, milisegundos
test-unit:
    cd backend && uv run pytest tests/unit -m unit --no-cov

# Umbrales de cobertura de líneas+ramas (%): global y para domain+application (lógica pura)
cov_min := "97"
cov_core_min := "100"

# Tests de integración: Postgres real (testcontainers) y Temporal de test; necesitan Docker o Podman
test-integration:
    #!/usr/bin/env bash
    set -euo pipefail
    cd backend
    if ! command -v docker >/dev/null 2>&1; then
        # Sin `docker` (p. ej. Podman-only): apuntar testcontainers al socket de Podman
        # y desactivar Ryuk, su sidecar de limpieza, que no funciona bien en rootless.
        export DOCKER_HOST="unix:///run/user/$(id -u)/podman/podman.sock"
        export TESTCONTAINERS_RYUK_DISABLED=true
    fi
    uv run pytest tests/integration -m integration --no-cov

# Toda la suite con cobertura de ramas y umbrales, más los tests (Vitest) y el build del frontend
test:
    #!/usr/bin/env bash
    set -euo pipefail
    cd backend
    if ! command -v docker >/dev/null 2>&1; then
        export DOCKER_HOST="unix:///run/user/$(id -u)/podman/podman.sock"
        export TESTCONTAINERS_RYUK_DISABLED=true
    fi
    uv run pytest
    core="src/duelo/domain/*,src/duelo/application/*"
    echo "cobertura (líneas+ramas): global $(uv run coverage report --format=total)% (mín {{cov_min}}%)," \
         "domain+application $(uv run coverage report --include="$core" --format=total)% (mín {{cov_core_min}}%)"
    uv run coverage report --fail-under={{cov_min}} >/dev/null \
        || { echo "FALLA: cobertura global por debajo de {{cov_min}}%" >&2; exit 1; }
    uv run coverage report --include="$core" --fail-under={{cov_core_min}} >/dev/null \
        || { echo "FALLA: cobertura de domain+application por debajo de {{cov_core_min}}%" >&2; exit 1; }
    cd ../frontend && pnpm test && pnpm build

# Lint + tipos en todo el repo (mismos checks que corre el CI)
lint:
    cd backend && uv run ruff check . && uv run ruff format --check . && uv run mypy src/ && uv run lint-imports
    cd frontend && pnpm exec biome check .

# Formatea todo el repo (Ruff con arreglos seguros + Biome); `just lint` comprueba sin tocar nada
format:
    cd backend && uv run ruff check --fix . && uv run ruff format .
    cd frontend && pnpm format

# Comprueba los tipos de todo el repo (mypy strict + tsc)
typecheck:
    cd backend && uv run mypy src/
    cd frontend && pnpm typecheck

# Reproduce localmente lo que corre el CI (sin gitleaks/osv-scanner/hadolint, que necesitan sus binarios aparte)
ci: lint typecheck test
    {{compose}} --profile infra config
    {{compose}} --profile app config

# Umbral mínimo de puntuación de mutación (%) sobre domain/ y application/
mutation_min := "95"

# Mutation testing sobre domain/ y application/ (unos segundos); falla bajo el umbral
mutation:
    #!/usr/bin/env bash
    set -euo pipefail
    cd backend
    rm -rf mutants
    uv run mutmut run 2>&1 | tr '\r' '\n' | grep -E "mutations/second|^[0-9]+/[0-9]+ " | tail -2 || true
    uv run mutmut export-cicd-stats >/dev/null
    uv run python ../scripts/mutation_gate.py mutants/mutmut-cicd-stats.json --min {{mutation_min}}
