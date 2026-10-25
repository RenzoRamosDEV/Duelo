# Duelo · frontend

React 19 + TypeScript + Vite con estilo de terminal retro (verde sobre negro). Sin tests de
frontend por decisión del proyecto ([ADR 0008](../docs/adr/0008-frontend-terminal-retro.md)): la red
de seguridad es `tsc` strict, Biome y el build.

## Arrancar

```sh
pnpm install
VITE_API_URL=http://localhost:8000 pnpm dev   # http://localhost:5173
pnpm build && pnpm preview                    # build de producción (PWA) en local
```

Sin `VITE_API_URL` el front enseña datos de ejemplo (`src/services/mockData.ts`) con el mismo
contrato que la API. El token de ingesta se escribe en Ajustes o en cada diálogo y vive solo en
memoria de la pestaña.

| Script | Qué hace |
| --- | --- |
| `pnpm lint` | Biome (lint y formato) |
| `pnpm format` | Biome con arreglos |
| `pnpm typecheck` | `tsc -b` |
| `pnpm gen:api` | Regenera `src/services/api.generated.ts` desde `../docs/openapi.json` |

## Estructura

```
src/
  main.tsx, App.tsx     arranque y tabla de rutas
  layouts/              AppLayout (barra lateral ≥1024 px, cajón móvil), SidebarNav, Brand
  pages/                una página por ruta: Projects, Channel, ChangeDetail, Stats, Settings, NotFound
  components/ui/        base reutilizable: Button, Input, Card, Badge, Table, Modal, Loader,
                        Skeleton, EmptyState, Notice, ErrorMessage, Segmented
  components/           de dominio: ReviewCard, FindingCard, FindingsPanel, DiffView, ChangeRow,
                        AgentChecks, AgentTag, StatusBadge, TokenField, diálogos de proyecto…
  services/             toda la red: http.ts (API), mock.ts, mappers.ts (DTO → modelo), source.ts
  hooks/                useAsync (carga + sondeo), useChannel, useProjects, useIngestToken…
  utils/                funciones puras: diff, markdown, findings, format, sort, paths…
  types/                modelo de vista
  styles/               tokens.css (único sitio con valores) + una hoja por bloque
```

Rutas: `/` proyectos, `/p/<owner>/<repo>` canal, `/p/<owner>/<repo>/changes/<id>` detalle,
`/stats`, `/settings`.

## Convenciones

- **Tokens primero.** Colores, espaciados, tipografías y medidas solo en `styles/tokens.css`; los
  componentes usan variables. Puntos de corte: 480, 768, 1024 y 1280 px, escritos solo en las hojas
  de `styles/`. La única propiedad inline es el ancho de las barras de Estadísticas, que es dato.
- **Sans para leer, mono para decorar.** El cuerpo va en la pila sans del sistema; la monospace solo
  en títulos, prompts `$`, badges, SHA, rutas y diff.
- **Texto secundario con contraste.** `--text-secondary` es `--color-fg-muted` sobre el fondo y pasa a
  `--color-fg-dim` dentro de `.card`, filas resaltadas y cabeceras del diff (4,5:1 en todos).
- **Los componentes no hacen `fetch`.** Todo pasa por `services/`; las páginas usan `useAsync` con
  `pollMs`/`pollWhile` (5 s en curso, 30 s en reposo, 60 s proyectos; pausa con la pestaña oculta).
- **Un componente por fichero**, nombres descriptivos, sin `any`, sin `console.log`, sin código muerto.
- **Accesibilidad.** Estados con glifo y texto (no solo color), `<dialog>` nativo para modales y
  cajón, controles de 44 px en táctil, `prefers-reduced-motion` y el interruptor de Ajustes apagan
  scanlines y parpadeo.

## PWA

El build es instalable (manifiesto en `vite.config.ts`) y abre sin conexión: el service worker
precachea el *app shell*; los datos de la API nunca se cachean. En desarrollo no hay service
worker. Con una versión nueva aparece «Nueva versión disponible» y la página no se recarga hasta
pulsar «Actualizar» (`components/UpdatePrompt.tsx`). Los iconos viven en `public/`.
