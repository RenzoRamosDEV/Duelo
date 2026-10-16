# Design

## Context

`docs/openapi.json` lo genera `scripts/dump_openapi.py` desde la app con fakes y lo vigila
`tests/unit/contract/test_openapi_contract.py`. `lib/api.ts` declara diez interfaces `*Dto` a
mano, algunas con campos opcionales «por si el servidor es antiguo» (`run?`, `review_status?`,
`commit_state?`, `reviews?`, `github?: boolean | string | null`). `openapi-typescript` 7.13 genera
`paths` y `components` como tipos puros, sin runtime.

## Goals / Non-Goals

**Goals:**
- Que un cambio en un modelo de Pydantic rompa `tsc` del frontend antes que una pantalla.
- Una sola fuente de verdad del contrato, con la cadena completa vigilada en CI.

**Non-Goals:**
- Un cliente HTTP generado (`openapi-fetch`): `createHttpSource` ya es pequeño y está probado;
  cambiarlo sería comportamiento, no tipos.
- Validar en tiempo de ejecución las respuestas (zod o similar).
- Mantener la compatibilidad con servidores anteriores a este repo: no existe ninguno.

## Decisions

**Tipos generados, commiteados y con check de deriva.** El fichero se commitea (así `tsc` y el IDE
funcionan sin paso previo) y el CI lo regenera y compara (`git diff --exit-code`). Alternativa
descartada: generarlo en `postinstall`; dejaría el repo sin el fichero y el check de deriva
dependería de que alguien ejecutase el build.

**`lib/api.ts` usa alias a `components["schemas"]`.** Cada `*Dto` pasa a ser
`type XDto = components["schemas"]["XResponse"]`. Los campos que antes eran opcionales «por si
acaso» pasan a ser los del contrato; los `??` que los cubrían se quitan si TypeScript los deja
como código muerto, y se quedan donde el valor puede ser `null` por contrato. `toChange` acepta el
elemento del canal sin `reviews` (`Omit<ChangeListItemResponse, "reviews">`) para servir también al
detalle.

**Generado = fuera de Biome, marcado en `.gitattributes`.** `biome.json` ignora
`src/lib/api.generated.ts` (si lo formatease, `gen:api` y el check de deriva se pelearían) y
`.gitattributes` lo marca `linguist-generated` para que los diffs lo plieguen.

**Recetas.** `pnpm gen:api` = `openapi-typescript ../docs/openapi.json -o src/lib/api.generated.ts`;
`just gen-client` lo llama; `just openapi` ejecuta el volcado y después `gen-client`, para que un
cambio deliberado de la API deje los dos ficheros al día de una vez.

## Risks / Trade-offs

- **Versión del generador**: una versión nueva puede cambiar el texto generado y disparar el check
  de deriva en una PR de Renovate. Es exactamente lo que se quiere ver: se regenera y se revisa.
- **Pérdida de las laxitudes a mano**: si algún test de `api.test.ts` alimentaba JSON sin campos
  que el contrato declara obligatorios, seguirá pasando (el JSON no se valida), pero el tipo del
  DTO ya no lo documenta. Aceptado: el contrato es la verdad.

## Migration Plan

Sin migración. Commits: `build(frontend)` dependencia + script + fichero generado,
`refactor(frontend)` `api.ts` con los tipos generados, `ci` check de deriva y recetas, `docs`.

## Open Questions

Ninguna.
