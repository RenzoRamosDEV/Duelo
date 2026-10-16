# Tasks

## 1. Generación

- [x] 1.1 `pnpm add -D openapi-typescript`, script `gen:api`, primer `src/lib/api.generated.ts`
      commiteado; `biome.json` lo ignora y `.gitattributes` lo marca generado; verificar que
      `pnpm gen:api` dos veces seguidas no cambia nada y que `pnpm typecheck` pasa.

## 2. DTOs del contrato

- [x] 2.1 `lib/api.ts`: cada `*Dto` como alias de `components["schemas"][...]`, sin interfaces a
      mano; verificar `pnpm typecheck`, `biome check` y la suite (`api.test.ts` incluida) en verde.

## 3. Recetas y CI

- [x] 3.1 `just gen-client` real y `just openapi` que lo encadena; paso del CI del frontend que
      regenera y falla si hay deriva; verificar con `actionlint` y ejecutando el paso en local.

## 4. Docs y cierre

- [x] 4.1 README (tabla de comandos, fila de la API en «Qué usa») y `docs/architecture.md`
      mencionan los tipos generados y el check de deriva.
- [ ] 4.2 `just ci` en verde; commits atómicos.
