# Design

## Context

Línea base medida el 2026-10-16: Ruff, mypy strict, import-linter y Biome en verde; 1282 tests
unitarios de backend y 668 de frontend pasan. El CI (`ci.yml`) corre lint y tests del backend y
solo Biome + build del frontend. `just test` tampoco ejecuta Vitest. Ruff selecciona `E, F, I,
UP, B`; con el set curado propuesto, `ruff check` reporta 2651 avisos, de los que 2160 son
`S101` (`assert` en tests) y 191 `PT018`; en `src/` el fallout real son unas 30 incidencias
mecánicas (`PTH*`, `SIM300`, `TRY300/301/004`, `RET504`, `PERF401`, `S103`, `S110`). Hay `# noqa`
de las familias `A`, `BLE`, `S` y `SLF` que hoy no están activas. El pre-commit fija
`ruff-pre-commit v0.7.4` mientras `uv.lock` resuelve Ruff 0.16.10.

## Goals / Non-Goals

**Goals:**
- Que ninguna regresión del frontend pase el CI ni `just ci`.
- Un único nombre por tarea (`test`, `lint`, `format`, `typecheck`, `dev`) que haga lo mismo en
  local, en pre-commit y en CI.
- Reglas de lint estrictas sin ruido: cada ignore global tiene motivo escrito en `pyproject.toml`.
- Repo sin ficheros de prueba ni placeholders muertos.

**Non-Goals:**
- Cambiar comportamiento de la aplicación o renombrar excepciones (`N818` se ignora a propósito).
- Tocar el pool de Vitest, mover tests por feature o partir el CSS: fase 3.
- Generar el cliente TypeScript desde OpenAPI: fase 4.
- Activar `ALL` en Ruff: mete familias de estilo contradictorias (`D`, `ANN`, `FBT`, `EM`, `COM`)
  cuyo fallout no aporta sobre mypy strict y el estilo actual.

## Decisions

**Set curado de Ruff, no `ALL`.** Se añaden las familias que detectan errores o deuda real:
`SIM` (simplificaciones), `RUF` (incluye `RUF100`, `noqa` sin efecto), `PTH` (`pathlib`), `PT`
(pytest), `ARG` (argumentos sin uso), `C4` (comprensiones), `RET` (returns), `TRY` (excepciones),
`S` (bandit), `A` (sombra de builtins), `BLE` (`except Exception` desnudo), `SLF` (miembros
privados), `PERF`, `PIE`, `T20` (`print`), `ISC` (concatenación implícita), `N` (nombres).
Ignores globales con su motivo en el propio `pyproject.toml`:
- `TRY003`: los mensajes de las excepciones del proyecto van en el `raise` a propósito (son
  mensajes para el usuario, no clases por mensaje).
- `N818`: las excepciones se llaman `ProjectNotFound`, `RetryNotAllowed`...; renombrarlas con
  sufijo `Error` es un diff enorme sin valor y la API las expone por nombre en los docstrings.
- `RUF001`, `RUF002`, `RUF003`: la documentación en español usa «», … y guiones tipográficos.
- `PT018`: las aserciones compuestas de los tests son legibles tal cual; partirlas en 191 sitios
  es ruido.
- `S603`, `S607`: todas las llamadas a subprocesos son listas de argumentos sin shell y los
  binarios (`git`, `gh`, los CLI) se resuelven por `PATH` por diseño; el motivo queda en
  `subprocess_runner.py` y `hook.py`.
`per-file-ignores` para `tests/**` y `scripts/**`: `S101` (assert), `S105`/`S106`/`S107`
(tokens de prueba), `S108` (rutas temporales), `SLF001` (los tests miran estado privado de
fakes), `ARG` (fakes que implementan protocolos con parámetros que no usan), `T20` en `scripts/`
(imprimen a propósito). Lo que quede en `src/` se corrige: `os.path.*` → `pathlib` en
`hook_installer.py` y `local_repository.py` (cubiertos por sus tests unitarios), `else` en `try`,
`S110` → `contextlib.suppress`, `S103` (el hook se escribe con `0o755 | 0o111` a propósito:
`noqa` con motivo). `hook.py` conserva `os.fork`/`os.dup2`/`os._exit` (no hay equivalente en
`pathlib`) y su `# noqa` pasa a tener efecto.
Alternativa descartada: activar las reglas por fases en varios changes; el fallout en `src/` es
pequeño y hacerlo de una vez evita tres rondas de "ahora sí falla el lint".

**Vitest entra en `just test`, en CI y no en pre-commit.** `just test` ya es la receta lenta
(suite completa con cobertura y build); añadir `pnpm test` ahí y en el job `frontend` del CI es
coherente. El pre-commit se queda con Biome y añade `tsc -b` (segundos); 30 s de Vitest en cada
commit romperían el flujo. `just ci` sigue siendo «lo mismo que GitHub Actions».

**Una receta por tarea, delegando en los scripts de cada paquete.** `just format` ejecuta
`ruff check --fix` + `ruff format` y `pnpm format` (`biome format --write .`); `just typecheck`
ejecuta `mypy src/` y `pnpm typecheck` (`tsc -b`); `just lint` se mantiene (Ruff sin arreglar,
`ruff format --check`, mypy, import-linter, `biome check`). Los scripts nuevos de `package.json`
(`typecheck`, `format`) evitan duplicar comandos entre `justfile`, pre-commit y CI. `mypy` sigue
en `lint` y en `typecheck`: en `lint` porque el CI lo encadena así desde el principio; en
`typecheck` porque es lo que un desarrollador busca con ese nombre. `just ci` pasa a
`lint typecheck test` + validación del compose.

**Pre-commit fija la misma versión de Ruff que `uv.lock`.** Hoy el hook formatea con 0.7.4 y el
CI con 0.16.10; dos formateadores distintos acaban en commits de ida y vuelta. Se sube la `rev` a
`v0.16.10` y se anota que debe subir con `uv.lock`.

**`gen-client` se elimina.** Un placeholder que imprime «pendiente» no es una receta; la fase 4
añade `just gen-client` con la generación real.

**Limpieza por `git rm`.** `info git.png`, `prueba.txt`, `prueba/Calculadora.java` y
`scripts/.gitkeep` desaparecen del árbol. `e2e/.gitkeep` y `benchmark/.gitkeep` se quedan:
`openspec/config.yaml` los declara como parte del layout de fases futuras.

## Risks / Trade-offs

- **Reglas nuevas que rompen un `uv run ruff` antiguo**: quien tenga un Ruff viejo en el PATH
  verá códigos desconocidos. Mitigación: todo pasa por `uv run`, que resuelve el `uv.lock`.
- **`PTH` en código sensible (`hook_installer.py`)**: cambiar `os.path.realpath` por
  `Path.resolve()` es equivalente para rutas existentes; los 472 líneas de tests del instalador
  (symlinks, `core.hooksPath` fuera del repo, permisos) lo cubren. Si alguna conversión no fuera
  equivalente, se deja `os.*` con `noqa` y motivo en vez de forzarla.
- **`just ci` más lento (≈30 s)**: aceptable; `just test-unit` sigue siendo el bucle rápido.
- **Fallout en tests al activar `ARG`/`SLF`** se resuelve con `per-file-ignores`, no tocando
  los tests: los fakes implementan protocolos y a veces ignoran parámetros por contrato.

## Migration Plan

Sin migración: es tooling. Orden de commits (Conventional Commits, uno por bloque, refactor
separado de tooling): `chore(repo)` limpieza, `build(just)` recetas y scripts, `ci` frontend tests
y tsc, `style(backend)`/`refactor(backend)` fallout de Ruff (configuración en un commit, código en
otro), `docs` README y testing.md.

## Open Questions

Ninguna bloqueante. Si al convertir `os.path` → `pathlib` en `hook_installer.py` un test deja
de pasar, se mantiene `os.*` con `noqa` justificado y se anota en `tasks.md`.
