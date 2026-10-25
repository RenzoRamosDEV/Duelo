# Proposal

## Why

La interfaz actual (estética GitHub + Slack, dos temas, efectos WebGL de libraries.dev y 70 ficheros
de test) ha crecido por rondas y su dueño quiere una identidad visual distinta y una base más simple
de mantener: un front rehecho de cero con estilo de terminal retro (verde sobre negro), legible,
100 % adaptable a móvil y con la misma funcionalidad y las mismas llamadas a la API. Se hace ahora,
sobre una API estable y con el contrato OpenAPI tipado, para que la reescritura no arrastre cambios
de backend.

## What Changes

- **BREAKING (visual)**: se borra `frontend/src` y se reescribe con una estética de terminal retro:
  fondo negro, verde para el texto, verde apagado para lo secundario y los bordes, verde oscuro para
  superficies, y un único color de alerta (ámbar). Tipografía sans-serif legible para todo el texto
  de lectura; monospace solo en títulos, prompts «$», badges y códigos. Contraste AA en todo el texto.
- **BREAKING**: desaparecen el tema claro, el selector Sistema/Claro/Oscuro, los logos de Duelo por
  tema y los logos de Claude y Codex como avatar; los agentes se identifican con una etiqueta de texto
  monospace. Se eliminan las dependencias `border-beam`, `img-fx`, `metal-fx`, `liquid-gooey`,
  `thinking-orbs` y `three`.
- Navegación: barra lateral en escritorio (marca, Proyectos, Estadísticas, Ajustes y la lista de
  proyectos vigilados) y menú hamburguesa que abre esa misma barra en móvil. Sustituye a la barra
  superior con selector de proyecto.
- Responsive obligatorio (mobile first, breakpoints 480/768/1024/1280): las tablas pasan a tarjetas o a
  scroll horizontal controlado en móvil, formularios a una columna, controles de 44 px de alto mínimo.
- Mismas rutas (`/`, `/p/<slug>`, `/p/<slug>/changes/<id>`, `/stats`, `/settings`, 404), mismas
  pantallas, mismos diálogos, mismo sondeo (5 s en curso, 30 s en reposo, 60 s proyectos), mismo
  token de ingesta en memoria, mismo modo mock sin `VITE_API_URL`, misma PWA con aviso de versión.
- Mismas llamadas a la API, concentradas en una capa `src/services` sobre los tipos generados de
  `docs/openapi.json`; los componentes no hacen `fetch`.
- **Sin tests de frontend**: se eliminan Vitest, Testing Library y jsdom, el paso `pnpm test` del CI
  y de `just test`, y la mención en `docs/testing.md`. Quedan `tsc -b`, Biome, `pnpm build` y la
  comprobación de deriva de `api.generated.ts`.
- Nuevo ADR 0008 «Frontend estilo terminal retro», que sustituye a los ADR 0003 y 0004 y deja sin
  efecto 0005 y 0006; `openspec/config.yaml`, README y `docs/architecture.md` se alinean.

## Capabilities

### New Capabilities

Ninguna: la navegación y la apariencia ya tienen capacidad propia.

### Modified Capabilities

- `frontend-shell`: la apariencia pasa a terminal retro de un solo tema. Se retiran los requisitos de
  temas claro/oscuro, selector líquido, anillo de metal, héroe de `img-fx`, brillo de borde, orbes,
  avatares con logo y logo de la aplicación por tema; se modifican «Estado de review en curso»,
  «Contraste accesible», «Agentes pendientes de un change», «Reviews como mensajes», «Ajustes en
  cajas» y «Estados vacíos y de error con ilustración»; se añaden «Estética de terminal retro
  legible», «Indicador de carga en texto» y «Diseño adaptable».
- `project-browser`: «Barra superior sin barra lateral» se sustituye por «Barra lateral con menú en
  móvil»; «Check por agente en cada fila» pasa de logo a etiqueta de texto; «Commits revertidos y
  deshechos en amarillo en la lista» deja de hablar de dos temas.

## Impact

- `frontend/` entero: `src/`, `index.html`, `vite.config.ts`, `package.json` (dependencias y scripts),
  `biome.json`, `tsconfig.app.json`, `public/` (se conservan iconos PWA y favicons), `README.md`.
- Tooling: `.github/workflows/ci.yml` (quitar `pnpm test`, nueva ruta del fichero generado),
  `justfile` (`test`, `gen-client`), `.gitattributes`, `.pre-commit-config.yaml` (sin cambios de
  hooks; `tsc` sigue).
- Documentación: `docs/adr/0008-*.md` nuevo y estados de 0003 a 0006, `docs/architecture.md`,
  `docs/testing.md`, `README.md` raíz, `openspec/config.yaml`.
- Backend y contrato OpenAPI: sin cambios.
