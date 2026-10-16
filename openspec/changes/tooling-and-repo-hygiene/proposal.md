# Proposal

## Por qué

Los 668 tests del frontend no corren en CI ni en `just test`/`just ci`: una regresión en la UI
pasaría el pipeline entero. Además el tooling tiene huecos que el resto del repo ya no tolera:
Ruff solo activa cinco familias de reglas (hay `# noqa` de familias que no están activas y nadie lo
detecta), faltan recetas únicas de `format` y `typecheck`, el pre-commit fija un Ruff de hace un
año distinto del que instala `uv`, y hay ficheros de prueba versionados en la raíz
(`info git.png`, `prueba.txt`, `prueba/Calculadora.java`). Es la primera fase del plan de
refactor acordado: arreglar las herramientas antes de tocar el código, para que las fases
siguientes (DRY en backend, estructura del frontend, contrato tipado) tengan red.

## Qué cambia

- **Tests del frontend en todas partes**: `just test` y `just ci` ejecutan Vitest además del
  build, el job de CI del frontend corre `pnpm test`, y el pre-commit comprueba los tipos del
  frontend (`tsc -b`) junto a Biome.
- **Recetas únicas**: `just format` (Ruff + Biome con escritura), `just typecheck` (mypy + tsc),
  `just lint` (sin cambios), `just test`, `just dev`; `just ci` encadena lint, typecheck y test.
  Se elimina el placeholder `just gen-client` (el cliente generado llega en la fase 4 con su
  receta real). `package.json` expone `typecheck` y `format` para que las recetas no repitan
  comandos.
- **Ruff estricto con criterio**: se amplía la selección a un set curado (`SIM, RUF, PTH, PT,
  ARG, C4, RET, TRY, S, A, BLE, SLF, PERF, PIE, T20, ISC, N`), con ignores globales justificados
  (p. ej. `TRY003`, `N818`, caracteres tipográficos del español) y `per-file-ignores` para tests
  (`assert`, secretos de prueba, acceso a miembros privados). El fallout en `src/` se corrige sin
  cambiar comportamiento; `RUF100` elimina los `noqa` muertos.
- **Pre-commit alineado**: la revisión de `ruff-pre-commit` pasa a la misma versión que resuelve
  `uv.lock`, para que el formateador del hook y el del CI sean el mismo.
- **Limpieza**: se borran `info git.png`, `prueba.txt`, `prueba/` y `scripts/.gitkeep` (la
  carpeta ya tiene ficheros). `e2e/.gitkeep` y `benchmark/.gitkeep` se quedan: son los huecos
  del plan por fases.
- **Docs**: README (tabla de comandos y párrafo de CI), `docs/testing.md` (tabla de recetas) y
  `docs/architecture.md` donde nombren recetas o checks.

Sin cambio de comportamiento observable de la aplicación: ni API, ni UI, ni workflows.

## Capacidades

### Nuevas capacidades

(ninguna: tooling y limpieza sin cambio de comportamiento; `skip_specs: true`)

### Capacidades modificadas

(ninguna)

## Impacto

- `justfile`, `frontend/package.json`, `.github/workflows/ci.yml`, `.pre-commit-config.yaml`,
  `backend/pyproject.toml` (`[tool.ruff.lint]`), ficheros de `backend/src` y `backend/tests` que
  toque el fallout de Ruff (cambios mecánicos: `pathlib`, `else` en `try`, `noqa` muertos),
  README, `docs/testing.md`, `docs/architecture.md`, y los ficheros borrados de la raíz.
- Sin dependencias nuevas. La subida de versión de Ruff solo afecta al hook de pre-commit (el
  proyecto ya resuelve `ruff>=0.7` a 0.16 con `uv`).
- `just ci` tarda unos 30 s más por los tests del frontend; el CI gana un paso en el job del
  frontend.
- Done-when: `just ci` pasa en limpio con el nuevo set de reglas, el CI ejecuta Vitest, `just
  format`/`just typecheck` existen y están documentados, no queda ningún `noqa` sin efecto y los
  ficheros de prueba han desaparecido del repo.
