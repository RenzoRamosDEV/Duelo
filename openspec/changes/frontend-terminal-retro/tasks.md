# Tasks

## 1. Decisión y limpieza

- [x] 1.1 ADR 0008 «Frontend estilo terminal retro» (sustituye 0003 y 0004; deja sin efecto 0005 y 0006) y actualizar el estado de esos ADR
- [x] 1.2 Borrar `frontend/src`, `src/test`, los tests y las dependencias de efectos y de test en `package.json`; `pnpm install`
- [x] 1.3 Estructura vacía: `components/ pages/ layouts/ services/ hooks/ utils/ types/ styles/`; mover `api.generated.ts` a `services/` y actualizar `gen:api`, `biome.json`, `.gitattributes` y el paso de deriva del CI
- [x] 1.4 `styles/tokens.css` (paleta, espaciados, tipografías, radios, breakpoints), `styles/base.css`, `styles/effects.css` (cursor, scanlines, reduced motion) e `index.html` con `theme_color #0a0a0a` y sin script de tema
- [x] 1.5 `AppLayout` con sidebar de escritorio y cajón móvil, rutas de `App.tsx` idénticas a las actuales y `NotFoundPage`

## 2. Componentes base

- [x] 2.1 `Button`, `Input`, `Card`, `Badge`, `Table` (scroll y variante tarjetas), `Modal` (`<dialog>`, foco, Escape, `dismissible`), `Loader`, `EmptyState`, `ErrorMessage`, `Prompt`
- [x] 2.2 Componentes de dominio: `AgentTag`, `StatusBadge`, `TokenField`, `CopyButton`, `Markdown`, `Collapsible`, `UpdatedAgo`
- [x] 2.3 Capa de servicios: `services/http.ts` (timeout 10 s, `ApiError`, `detail`, codificación de slugs), `services/api.ts` (las 10 funciones), `services/mock.ts`, `services/mappers.ts`, `services/source.tsx` (contexto y `useAgentNames`)
- [x] 2.4 Hooks y utilidades: `useAsync` con sondeo y pausa por visibilidad, `usePolling`, `useDebouncedValue`, `useIngestToken`, `useNow`, `useEffectsPreference`; `utils/` de formato, tiempo relativo, severidades, runs, pendientes, commit state, diff, markdown, sanitize, recomendación, URL segura, rutas

## 3. Pantallas

- [x] 3.1 Proyectos (`/`): lista, badges, vacío, diálogo «Añadir proyecto» con validación y errores por código
- [x] 3.2 Canal (`/p/:slug`): buscador con debounce y atajo «/», filtros de tipo y estado, contadores, filas con checks y estado deshecho/revertido, «Cargar más», sondeo 5 s/30 s, 404 y vacíos
- [x] 3.3 Detalle (`/p/:slug/changes/:id`): migas, banner de commit deshecho, estado, acciones de copiar y GitHub, agentes pendientes, reviews, panel de hallazgos por severidad y archivo, runs anteriores, reintento, diff con índice; sondeo mientras está en curso
- [x] 3.4 Estadísticas (`/stats`): tarjetas de resumen ponderadas y tabla ordenable con variante tarjetas en móvil
- [x] 3.5 Ajustes (`/settings`): Pantalla (efectos), General (agentes activos, voto ciego próximamente), Proyectos vigilados (añadir, quitar con confirmación, sincronizar PRs, elegir agentes), Diagnóstico
- [x] 3.6 PWA: `UpdatePrompt` solo en producción y `vite.config.ts` sin chunks de efectos ni configuración de test

## 4. Cierre

- [x] 4.1 Pasada responsive en 375, 768 y 1440 px de las cinco pantallas y los diálogos (capturas en headless) y comprobación de contraste de los tokens
- [x] 4.2 Pasada de accesibilidad: foco visible, nombres accesibles, `prefers-reduced-motion`, cajón móvil con teclado
- [x] 4.3 Limpieza: cero código muerto, estilos inline, `any` y `console.log`; `pnpm lint`, `pnpm typecheck`, `pnpm build` y `pnpm gen:api` sin deriva
- [x] 4.4 Tooling: quitar `pnpm test` del CI y de `just test`, actualizar `docs/testing.md`
- [x] 4.5 Docs: `frontend/README.md` corto (arrancar, estructura, convenciones), README raíz, `docs/architecture.md`, `openspec/config.yaml`

## 5. Rediseño visual con jerarquía (revisión 2026-10-25)

- [ ] 5.1 `tokens.css` con la paleta por jerarquía, escala tipográfica, espaciado 4–32, radios 4–6 y transición 150 ms; sin verdes fuera del fichero
- [ ] 5.2 Componentes base revisados: Button (primary/secondary/ghost/danger, 36/44 px), Input, Chip/Badge (neutral/status/count), StatusIcon sin caja, Card elevada, Table con flecha de orden, Segmented, Modal, Toast, Kbd, EmptyState, Skeleton, Loader, PageHeader
- [ ] 5.3 Layout: sidebar de 240 px elevada con activo por barra izquierda, etiquetas de sección y pie de conexión; contenido con padding 32/16; foco visible en acento
- [ ] 5.4 Canal: barra sticky (buscador + segmento), chips de estado con contador y punto rojo si hay fallos, filas sin caja en grid [estado][contenido][reviews][tiempo], hover con título en acento
- [ ] 5.5 Detalle: PageHeader con chips y acciones, dos columnas en escritorio con pestañas Reviews / Hallazgos / Diff y card de resumen; una columna en móvil
- [ ] 5.6 Proyectos (cards con acción y «+ Añadir» discontinua) y Estadísticas (fila de KPI, Table ordenable)
- [ ] 5.7 Ajustes en cards con etiqueta a la izquierda y control a la derecha; diálogo de añadir con validación inline
- [ ] 5.8 Estados globales (Skeleton en el mismo layout, EmptyState, Toast de resultado, modal de confirmación) y pasada responsive 375/768/1440
- [ ] 5.9 Limpieza (sin estilos inline ni código muerto), contraste comprobado y README del front actualizado
