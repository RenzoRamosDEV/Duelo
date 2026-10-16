# Tasks

## 1. Limpieza del repositorio

- [ ] 1.1 `git rm` de `info git.png`, `prueba.txt`, `prueba/Calculadora.java` y
      `scripts/.gitkeep`; verificar que `git status` queda limpio y que nada del repo los
      referencia (`grep -rn "prueba\|info git" --exclude-dir=.git`).

## 2. Recetas únicas (justfile y package.json)

- [ ] 2.1 `frontend/package.json`: scripts `typecheck` (`tsc -b`) y `format`
      (`biome format --write .`); verificar que `pnpm typecheck` y `pnpm format` corren en
      limpio.
- [ ] 2.2 `justfile`: recetas `format` (`ruff check --fix` + `ruff format` + `pnpm format`) y
      `typecheck` (`mypy src/` + `pnpm typecheck`); `test` ejecuta `pnpm test` antes del build
      del frontend; `ci` pasa a `lint typecheck test`; eliminar `gen-client`; verificar que
      `just format` sobre el árbol actual no produce cambios y que `just typecheck` pasa.

## 3. CI y pre-commit

- [ ] 3.1 `.github/workflows/ci.yml`: el job del frontend (renombrado `frontend`) añade
      `pnpm test` tras `biome check` y antes de `pnpm build`; verificar con `actionlint` si está
      disponible (si no, con la validación del CI al hacer push).
- [ ] 3.2 `.pre-commit-config.yaml`: hook `tsc` del frontend (`pnpm typecheck`, `files:
      ^frontend/.*\.(ts|tsx)$`), y `ruff-pre-commit` a la misma versión que `uv.lock`
      (`v0.16.10`, con comentario «subir junto a uv.lock»); verificar con
      `pre-commit run --all-files`.

## 4. Ruff estricto

- [ ] 4.1 `backend/pyproject.toml`: ampliar `select` al set curado, `ignore` globales con un
      comentario por regla, `per-file-ignores` para `tests/**` y `scripts/**`
      (ver `design.md`); verificar con `uv run ruff check . --statistics` que lo que queda está
      todo en `src/` y es mecánico.
- [ ] 4.2 Corregir el fallout en `src/` sin cambiar comportamiento: `pathlib` en
      `adapters/git/hook_installer.py` y `adapters/git/local_repository.py`, `else` en los `try`
      que lo pidan, `contextlib.suppress` donde haya `except: pass`, `SIM300`, `RET504`,
      `PERF401`; eliminar los `noqa` sin efecto que señale `RUF100` y dar motivo a los que se
      queden (`S103`, `A002`, `BLE001`); verificar `just lint` y `just test-unit` en verde.
- [ ] 4.3 Corregir el fallout en `tests/` que no cubran los `per-file-ignores` (`PT011` con
      `match=`, `RUF043`, imports sin uso); verificar `uv run pytest tests/unit -m unit --no-cov`.

## 5. Documentación

- [ ] 5.1 README: tabla de comandos con `just format` y `just typecheck`, `just test` «incluye
      los tests del frontend», sin `gen-client`; párrafo de CI con los tests del frontend.
- [ ] 5.2 `docs/testing.md`: tabla «Cómo ejecutar» con `just test` incluyendo Vitest y la
      mención a `pnpm test` directo; `docs/architecture.md` si nombra recetas afectadas.

## 6. Cierre

- [ ] 6.1 `just ci` completo en verde (lint, typecheck, tests backend con umbrales, Vitest,
      build, validación del compose); commits atómicos en Conventional Commits separando
      limpieza, recetas, CI, configuración de Ruff, refactor mecánico y docs.
