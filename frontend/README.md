# Duelo · frontend

React 19 + TypeScript + Vite con estilo de terminal retro (verde sobre negro, con jerarquía por
tono). Sin tests de
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
  components/ui/        base reutilizable: PageHeader, Button, Input, Card, Badge, StatusIcon,
                        Icon, Table, Tabs, Segmented, Modal, Toast, Notice, ErrorMessage, Kbd,
                        Loader, Skeleton, EmptyState
  components/           de dominio: ReviewCard, FindingCard, FindingsPanel, ChangeSummary, DiffView,
                        ChangeRow, AgentChecks, AgentTag, StatusBadge, TokenField, diálogos…
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
- **Jerarquía por tono, no por caja.** `--fg-primary` para texto principal, títulos y cifras;
  `--fg-muted` para descripciones, autor, fecha y etiquetas; `--fg-dim` para SHA, separadores,
  etiquetas de sección y placeholders; `--fg-accent` solo para UN acento por bloque (activo, prompt
  `$`, hover de enlace, foco). Fondos `--bg` / `--bg-elev` (sidebar, cards, modales) / `--bg-hover`;
  bordes `--border` que solo se encienden (`--border-hi`) en activo, hover y foco; `--border-strong`
  para los límites de campos (3:1).
- **Semánticos.** `--ok` (= acento) para lo completado, `--warn` (ámbar) para lo que está en curso o
  deshecho y las severidades medias, `--err` (rojo) para fallos y severidades graves, `--info` (azul)
  para severidades menores. Todo estado lleva glifo y texto además de color.
- **Sans para leer, mono para decorar.** El cuerpo va en la pila sans del sistema a 15 px; la
  monospace solo en el logo, el prompt `$`, SHA, ramas, chips `[claude]`/`[codex]`, etiquetas en
  mayúsculas y código/diff. Escala: h1 22, h2 18, h3 15 seminegrita, cuerpo 15, meta 13, etiqueta 11.
- **Los componentes no hacen `fetch`.** Todo pasa por `services/`; las páginas usan `useAsync` con
  `pollMs`/`pollWhile` (5 s en curso, 30 s en reposo, 60 s proyectos; pausa con la pestaña oculta).
- **Un componente por fichero**, nombres descriptivos, sin `any`, sin `console.log`, sin código muerto.
- **Accesibilidad.** `<dialog>` nativo para modales y cajón, pestañas con `tablist` y flechas,
  controles de 36 px en escritorio y 44 en táctil, foco visible en acento, `prefers-reduced-motion`
  y el interruptor de Ajustes apagan scanlines, parpadeo y pulso del esqueleto. Transiciones de
  150 ms.

## PWA

El build es instalable (manifiesto en `vite.config.ts`) y abre sin conexión: el service worker
precachea el *app shell*; los datos de la API nunca se cachean. En desarrollo no hay service
worker. Con una versión nueva aparece «Nueva versión disponible» y la página no se recarga hasta
pulsar «Actualizar» (`components/UpdatePrompt.tsx`). Los iconos viven en `public/`.
