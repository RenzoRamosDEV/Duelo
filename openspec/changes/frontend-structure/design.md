# Design

## Context

`data/mock.ts` empieza con 98 líneas de tipos y sigue con los datos de ejemplo; 23 módulos de
producción y 13 tests importan tipos de ahí, y `data/source.tsx` mezcla en un import el tipo
`Change` con los datos. `round2/3/4.test.tsx` y `redesign.test.tsx` (1294 líneas) montan `<App>`
con un `DataSource` falso y prueban canal, detalle, estadísticas, ajustes, portada y marco; cada
uno con su propio `renderWith` (con `NowProvider`, con agentes `agent_1/agent_2`, con reset del
tema). `index.css` tiene 14 secciones marcadas con `/* ---------- Nombre ---------- */`. El bundle
actual: `dist/assets/index-CA9jeGkd.css` (29,37 kB).

## Goals / Non-Goals

**Goals:**
- Que cada fichero se llame por lo que contiene y viva junto a la feature que prueba o estiliza.
- Cero cambio de comportamiento: mismos tests, mismo CSS compilado, mismos tipos.

**Non-Goals:**
- Reescribir tests ni cambiar aserciones.
- Tocar los tests transversales que ya se llaman por su tema (`orbs`, `fx`, `brand`,
  `livePolling`, `agentLogos`, `localProjects`...).
- Generar los tipos de la API desde OpenAPI (fase 4).
- CSS modules o Tailwind: fuera del alcance, decidido en ADR 0003.

## Decisions

**`data/types.ts` con el modelo de vista.** Se mueve el bloque de tipos entero (incluido
`Project`, que `mock.ts` importa). Los imports se reescriben de forma mecánica: un `import type`
desde `data/mock` pasa a `data/types`; el import mixto de `source.tsx` se parte en dos. `tsc -b`
y Biome (orden de imports) validan el resultado.

**Reparto de `describe` por página, con un helper común.** `test/render.tsx` expone
`renderApp(path, source?, { now? })`: monta `DataSourceProvider` + `MemoryRouter` + `<App>` y
envuelve con `NowProvider` solo si se pasa `now`. Los `describe` que dependían de agentes
`agent_1/agent_2` (los de `redesign`) declaran ese `health` en su propio fichero; los que
reseteaban el tema o el token conservan su `beforeEach` en el fichero de destino. Reparto:
- `features/channel/ChannelPage.test.tsx`: load states (canal), load more, server-side filters,
  change age, compact channel, actionable empty state, aggregate status in the row, channel rows,
  «/» focuses the search, loading placeholders.
- `features/review/ChangeDetailPage.test.tsx`: change detail, diff file navigator, retry review,
  review metadata, change detail as a conversation.
- `features/stats/StatsPage.test.tsx`: sortable stats, real stats, statistics cards.
- `features/settings/SettingsPage.test.tsx`: settings diagnostics, settings: appearance.
- `features/projects/EntryPage.test.tsx`: empty state sin proyectos, empty installation.
- `layout/Shell.test.tsx` (existente): app frame. `App.test.tsx` (existente): not-found page.
Alternativa descartada: renombrar los cuatro ficheros sin partirlos; seguirían mezclando páginas.

**CSS: un fichero por sección, `index.css` solo importa.** Se corta por las marcas
`/* ---------- ... ---------- */` existentes, en orden, y `index.css` queda como
`@import "./styles/tokens.css"; @import "./styles/base.css"; ...`. Vite resuelve los `@import`
en build (postcss-import integrado) y concatena en el mismo orden, así que la cascada no cambia; la
prueba es que el hash del bundle CSS coincide con el de antes. Alternativa descartada: CSS por
componente junto a cada `.tsx`; obligaría a decidir dónde van las reglas compartidas y cambiaría
el orden de la cascada.

**Pool de Vitest, medido.** Se prueba `pool: "vmThreads"` (lo que sugiere el propio Vitest para no
crear jsdom por fichero). Se adopta solo si los 668 tests siguen en verde y el tiempo total baja;
si algún test depende del aislamiento del entorno, se descarta y queda anotado.

## Risks / Trade-offs

- **Un `describe` movido cambia de contexto** (helper distinto, `beforeEach` perdido). Mitigación:
  el helper común reproduce los tres montajes y cada `beforeEach` viaja con sus tests; el
  recuento de tests debe seguir en 668.
- **`@import` en CSS**: en desarrollo Vite los sirve como ficheros separados (más peticiones); en
  build se concatenan. Sin efecto en producción.
- **`vmThreads`** comparte el entorno entre ficheros del mismo worker: un test que deje estado en
  `document` podría afectar a otro. `setup.ts` ya limpia con `cleanup()`; si aparece un fallo
  intermitente, se descarta el cambio.

## Migration Plan

Sin migración. Commits: `refactor(frontend)` tipos, `test(frontend)` reparto, `style(frontend)`
CSS, `perf(test)` pool si se adopta.

## Open Questions

Ninguna.
