# Proposal

## Por qué

El contrato de la API vive en `docs/openapi.json`, que el CI mantiene en sincronía con los modelos
de Pydantic, pero el frontend escribe sus DTOs a mano en `lib/api.ts`: nada avisa si el backend
renombra un campo o cambia un tipo hasta que una pantalla falla. `openspec/config.yaml` ya fija que
el cliente TypeScript se genera del OpenAPI y que el CI falla si deriva. Es la fase 4 del plan de
refactor y cierra ese hueco con una sola dependencia de desarrollo.

## Qué cambia

- **Tipos generados del contrato.** `openapi-typescript` (devDep) genera
  `frontend/src/lib/api.generated.ts` a partir de `docs/openapi.json`; `pnpm gen:api` y
  `just gen-client` lo regeneran, y `just openapi` lo encadena tras volcar el snapshot.
- **`lib/api.ts` tipa sus DTOs contra `components["schemas"]`** en vez de interfaces a mano. Las
  funciones de mapeo al modelo de vista y el `DataSource` no cambian de forma, así que las páginas
  y los tests no se tocan.
- **Deriva detectada en CI.** El job del frontend regenera los tipos y falla si el fichero
  generado no coincide con el commiteado; con el snapshot vigilado por el backend, la cadena
  Pydantic → OpenAPI → TypeScript queda cerrada.
- El fichero generado queda fuera de Biome (se formatea solo con su generador) y se marca como
  generado en `.gitattributes`.

Sin cambio de comportamiento observable: las peticiones y el modelo de vista son los mismos.

## Capacidades

### Nuevas capacidades

(ninguna: tooling de tipos sin cambio de comportamiento; `skip_specs: true`)

### Capacidades modificadas

(ninguna)

## Impacto

- `frontend/package.json` (devDep `openapi-typescript`, script `gen:api`), `pnpm-lock.yaml`,
  `frontend/src/lib/api.generated.ts` (nuevo, generado), `frontend/src/lib/api.ts`,
  `frontend/biome.json`, `.gitattributes`, `justfile` (`gen-client`, `openapi`),
  `.github/workflows/ci.yml`, README y `docs/architecture.md`.
- Dependencia nueva: `openapi-typescript` (solo desarrollo, sin runtime). Trade-off aceptado por
  el usuario el 2026-10-16: una devDep a cambio de que el contrato no pueda divergir a mano.
- Done-when: `just ci` en verde, `pnpm gen:api` idempotente sobre el árbol commiteado, y ningún
  DTO declarado a mano en `lib/api.ts`.
