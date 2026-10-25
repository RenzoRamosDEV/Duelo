# Tasks

## 1. Decisión y limpieza

- [ ] 1.1 ADR 0008 «Frontend estilo terminal retro» (sustituye 0003 y 0004; deja sin efecto 0005 y 0006) y actualizar el estado de esos ADR
- [ ] 1.2 Borrar `frontend/src`, `src/test`, los tests y las dependencias de efectos y de test en `package.json`; `pnpm install`
- [ ] 1.3 Estructura vacía: `components/ pages/ layouts/ services/ hooks/ utils/ types/ styles/`; mover `api.generated.ts` a `services/` y actualizar `gen:api`, `biome.json`, `.gitattributes` y el paso de deriva del CI
- [ ] 1.4 `styles/tokens.css` (paleta, espaciados, tipografías, radios, breakpoints), `styles/base.css`, `styles/effects.css` (cursor, scanlines, reduced motion) e `index.html` con `theme_color #0a0a0a` y sin script de tema
- [ ] 1.5 `AppLayout` con sidebar de escritorio y cajón móvil, rutas de `App.tsx` idénticas a las actuales y `NotFoundPage`

## 2. Componentes base

- [ ] 2.1 `Button`, `Input`, `Card`, `Badge`, `Table` (scroll y variante tarjetas), `Modal` (`<dialog>`, foco, Escape, `dismissible`), `Loader`, `EmptyState`, `ErrorMessage`, `Prompt`
- [ ] 2.2 Componentes de dominio: `AgentTag`, `StatusBadge`, `TokenField`, `CopyButton`, `Markdown`, `Collapsible`, `UpdatedAgo`
- [ ] 2.3 Capa de servicios: `services/http.ts` (timeout 10 s, `ApiError`, `detail`, codificación de slugs), `services/api.ts` (las 10 funciones), `services/mock.ts`, `services/mappers.ts`, `services/source.tsx` (contexto y `useAgentNames`)
- [ ] 2.4 Hooks y utilidades: `useAsync` con sondeo y pausa por visibilidad, `usePolling`, `useDebouncedValue`, `useIngestToken`, `useNow`, `useEffectsPreference`; `utils/` de formato, tiempo relativo, severidades, runs, pendientes, commit state, diff, markdown, sanitize, recomendación, URL segura, rutas

## 3. Pantallas

- [ ] 3.1 Proyectos (`/`): lista, badges, vacío, diálogo «Añadir proyecto» con validación y errores por código
- [ ] 3.2 Canal (`/p/:slug`): buscador con debounce y atajo «/», filtros de tipo y estado, contadores, filas con checks y estado deshecho/revertido, «Cargar más», sondeo 5 s/30 s, 404 y vacíos
- [ ] 3.3 Detalle (`/p/:slug/changes/:id`): migas, banner de commit deshecho, estado, acciones de copiar y GitHub, agentes pendientes, reviews, panel de hallazgos por severidad y archivo, runs anteriores, reintento, diff con índice; sondeo mientras está en curso
- [ ] 3.4 Estadísticas (`/stats`): tarjetas de resumen ponderadas y tabla ordenable con variante tarjetas en móvil
- [ ] 3.5 Ajustes (`/settings`): Pantalla (efectos), General (agentes activos, voto ciego próximamente), Proyectos vigilados (añadir, quitar con confirmación, sincronizar PRs, elegir agentes), Diagnóstico
- [ ] 3.6 PWA: `UpdatePrompt` solo en producción y `vite.config.ts` sin chunks de efectos ni configuración de test

## 4. Cierre

- [ ] 4.1 Pasada responsive en 375, 768 y 1440 px de las cinco pantallas y los diálogos (capturas en headless) y comprobación de contraste de los tokens
- [ ] 4.2 Pasada de accesibilidad: foco visible, nombres accesibles, `prefers-reduced-motion`, cajón móvil con teclado
- [ ] 4.3 Limpieza: cero código muerto, estilos inline, `any` y `console.log`; `pnpm lint`, `pnpm typecheck`, `pnpm build` y `pnpm gen:api` sin deriva
- [ ] 4.4 Tooling: quitar `pnpm test` del CI y de `just test`, actualizar `docs/testing.md`
- [ ] 4.5 Docs: `frontend/README.md` corto (arrancar, estructura, convenciones), README raíz, `docs/architecture.md`, `openspec/config.yaml`
