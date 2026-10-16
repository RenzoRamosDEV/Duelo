# Tasks

## 1. Tipos del modelo de vista

- [x] 1.1 `data/types.ts` con los tipos de `data/mock.ts`; `mock.ts` los importa; reescribir
      todos los imports de tipos (producción, fixtures y tests) a `data/types`; verificar
      `pnpm typecheck`, `biome check` y que ningún fichero importa tipos desde `data/mock`.

## 2. Tests por feature

- [x] 2.1 `test/render.tsx` con `renderApp(path, source?, { now? })`.
- [x] 2.2 Repartir los `describe` de `round2`, `round3`, `round4` y `redesign` según `design.md`
      y borrar los cuatro ficheros; verificar que Vitest sigue en 668 tests y 68 ficheros (los
      cuatro borrados, seis nuevos o ampliados... el total de tests es lo que no cambia).

## 3. CSS por sección

- [x] 3.1 Partir `index.css` por sus marcas en `styles/*.css` e `index.css` con los `@import`
      en el mismo orden; verificar que `pnpm build` produce un CSS con el mismo hash
      (`index-CA9jeGkd.css`).

## 4. Pool de Vitest

- [ ] 4.1 Medir la suite con `pool: "vmThreads"`; adoptarlo solo si pasa en verde y baja el
      tiempo, y anotar la medida aquí.

## 5. Cierre

- [ ] 5.1 `just ci` en verde; commits atómicos por bloque.
