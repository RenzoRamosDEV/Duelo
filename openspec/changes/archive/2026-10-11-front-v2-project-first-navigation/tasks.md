# Tasks

## 1. Marco: barra superior y selector de proyecto

- [x] 1.1 `layout/Shell.tsx`: quitar la barra lateral, el cajón, el velo y el botón «Menú»; barra superior con marca (`/`), `ProjectSwitcher`, enlaces a Estadísticas y Ajustes (iconos con `aria-label` en estrecho, activo marcado) y el tema. Nuevo `features/projects/ProjectSwitcher.tsx`: `<select>` nativo con los proyectos y «Añadir proyecto…» al final, visible solo bajo `/p/`, valor derivado de `parseProjectPath`; cambiarlo navega a `projectPath(slug)`. Tests (`layout/Shell.test.tsx`, `ProjectSwitcher.test.tsx`): sin `nav` lateral ni botón «Menú»; el selector aparece en `/p/x/y` y no en `/` ni en `/settings`; elegir otro proyecto cambia la ruta; «Añadir proyecto…» abre el diálogo; Estadísticas y Ajustes marcan `aria-current`. Verificación: `pnpm test src/layout src/features/projects`.

## 2. Entrada: selector de proyectos

- [x] 2.1 `features/projects/ProjectPicker.tsx` y `App.tsx` (`/` renderiza el selector; se elimina `FirstProject`): rejilla de tarjetas enlazadas a `/p/:slug` con nombre, etiquetas GitHub/Local/Hooks y ruta, tarjeta «Añadir proyecto», estados de carga, error con reintento y vacío. Tests: dos proyectos → dos enlaces con su `href`; `/` no redirige; vacío → «Añadir proyecto»; error → «Reintentar»; la tarjeta de alta abre el diálogo. Verificación: `pnpm test src/features/projects`.

## 3. Lista compacta del proyecto

- [x] 3.1 `components/AgentChecks.tsx` con tests: Claude completada + Codex pendiente → «Claude: completada» con check y «Codex: en espera» sin check; fallida con aspa; agente desconocido con iniciales; run nueva → ambos en espera; sin agentes esperados solo los que tienen review; nombre accesible y forma (no solo color). Verificación: `pnpm test src/components/AgentChecks`.
- [x] 3.2 `features/channel/ChannelPage.tsx`: fila compacta de una línea con enlace completo al detalle (un solo `<a>`, `::after` cubriendo la fila), estado, tipo, título, `#sha`, autor, antigüedad, `AgentChecks` y, en commits deshechos o revertidos, fila amarilla con la etiqueta y el subtítulo en línea; se eliminan el hilo («Ver respuestas», `useFullReviews`), las insignias de resumen, `PendingAgents`, el interruptor de densidad y `ReviewCard` de la lista; se conservan búsqueda, filtro por tipo, pestañas de estado, «Cargar más», contadores (con deshechos y revertidos), refresco, estado vacío y proyecto no encontrado. Reescribir por comportamiento los tests que usaban hilo, densidad o tarjetas (`agentsAndRuns`, `orbs`, `livePolling`, `redesign`, `round3`, `round4`, `undoneCommits`, `fx`, `localProjects`, `App.test`): fila = un enlace al detalle; sin «Ver respuestas»; checks por agente; commit revertido/deshecho amarillo con su texto; PR nunca marcada; contadores; pestaña oculta/refresco; búsqueda conservada. Verificación: `pnpm test` en verde.

## 4. Detalle en página propia

- [x] 4.1 `features/review/ChangeDetailPage.tsx`: migas «Proyectos / `slug` / `sha`» enlazadas a `/` y `projectPath(slug)`; el resto sin cambios. Tests: pulsar la fila de la lista navega a `/p/:slug/changes/:id` y muestra reviews, hallazgos y diff; las migas vuelven al proyecto y a la entrada; change inexistente → «Change no encontrado». Verificación: `pnpm test src/features/review src/features/projectRoutes.test.tsx`.

## 5. Estilos, documentación y comprobación visual

- [x] 5.1 `index.css`: eliminar `.sidebar`, `.nav-*`, `.scrim`, `.menu-toggle`, `.thread`, `.review-summary` y las variantes de densidad; añadir la barra superior con enlaces, el selector de proyecto, la rejilla de tarjetas y la fila compacta con sus chips, todo con los tokens existentes (claro y oscuro, contraste AA incluido el amarillo y el enlace activo). Actualizar `lib/contrast` y su test si el elemento «seleccionado de la barra lateral» deja de existir. Verificación: `pnpm lint` y `pnpm test` en verde.
- [x] 5.2 Docs: `frontend/README.md` (flujo de tres niveles y rutas), `docs/architecture.md` (frontend) y `docs/testing.md` (filas del frontend). Verificación: `grep -rn "barra lateral\|Ver respuestas" frontend/README.md docs/ README.md` sin resultados salvo históricos.
- [x] 5.3 Comprobación visual con Chrome headless (Playwright de la sesión) contra la API local con datos reales: capturas de `/`, `/p/RenzoRamosDEV/Duelo` y un detalle, en claro, oscuro y 390 px de ancho; se revisa que el commit revertido o deshecho sale amarillo, que cada fila muestra el check de Claude y Codex y que no hay desbordes horizontales. Verificación: capturas revisadas y ningún error de consola.

## 6. Cierre

- [x] 6.1 `just ci` en verde (lint, tipos, tests con cobertura y build del frontend). Verificación: salida de `just ci`.

## Workflow follow-up

- Archivar el change (`openspec archive`) y commit/PR de `front-v2` cuando el usuario lo pida.
