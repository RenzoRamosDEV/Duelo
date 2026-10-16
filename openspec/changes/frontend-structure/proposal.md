# Proposal

## Por qué

El frontend funciona y está bien probado (668 tests), pero su estructura no dice dónde está cada
cosa: los tipos del modelo de vista (`Change`, `Review`, `Health`...) viven en `data/mock.ts`,
un fichero de datos de ejemplo, y 23 módulos de producción los importan de ahí; unas 1300 líneas
de tests de página se llaman por el change de OpenSpec que las trajo (`round2`, `round3`,
`round4`, `redesign`) y no por lo que prueban; y `index.css` son 2128 líneas en un solo fichero
con secciones comentadas. Es la fase 3 del plan de refactor: estructura por feature, sin cambiar
un píxel ni una regla.

## Qué cambia

- **Tipos en su sitio.** `data/types.ts` con el modelo de vista; `data/mock.ts` queda solo con
  los datos de ejemplo y los importa. Todos los `import type ... from "data/mock"` pasan a
  `data/types`.
- **Tests por feature.** Los `describe` de `round2`, `round3`, `round4` y `redesign` se reparten
  entre `features/channel/ChannelPage.test.tsx`, `features/review/ChangeDetailPage.test.tsx`,
  `features/stats/StatsPage.test.tsx`, `features/settings/SettingsPage.test.tsx`,
  `features/projects/EntryPage.test.tsx` y `layout/Shell.test.tsx`, con un helper común
  `test/render.tsx` para montar la app. Los cuatro ficheros antiguos desaparecen; el número de
  tests no cambia.
- **CSS por sección.** `index.css` pasa a ser una lista de `@import` en el mismo orden;
  cada sección (`base`, `shell`, `primitives`, `loading`, `channel`, `reviews`, `findings`,
  `detail`, `stats`, `settings`, `responsive`, `effects`, `update-prompt`, `project-picker`) es un
  fichero en `styles/`. El bundle de CSS resultante es byte a byte el mismo.
- **Vitest más rápido.** jsdom se creaba 68 veces (46 % del tiempo de la suite); se prueba el
  pool `vmThreads` y se adopta solo si la suite sigue en verde y mejora de forma medible.

Sin cambio de comportamiento observable: ni UI, ni contrato con la API, ni estilos.

## Capacidades

### Nuevas capacidades

(ninguna: reorganización sin cambio de comportamiento; `skip_specs: true`)

### Capacidades modificadas

(ninguna)

## Impacto

- `frontend/src/data/{types,mock}.ts`, los 23 módulos que importan tipos, `test/fixtures.ts`,
  los 13 tests que importan tipos de `mock`, los cuatro tests reubicados y los seis ficheros que
  los reciben, `index.css` y la carpeta `styles/`, `vite.config.ts` si el pool se adopta.
- Sin dependencias nuevas.
- Done-when: `just ci` en verde, el CSS compilado con el mismo hash que antes, 668 tests (los
  mismos) y ningún import de tipos desde `data/mock`.
