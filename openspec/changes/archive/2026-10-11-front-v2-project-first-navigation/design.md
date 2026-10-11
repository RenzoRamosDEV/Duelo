# Design

## Context

- Hoy: `App.tsx` redirige `/` al primer proyecto (`FirstProject`); `layout/Shell.tsx` tiene barra
  superior + barra lateral (cajón en móvil); `ChannelPage.tsx` (471 líneas) pinta cada change como
  tarjeta con título, meta, insignias de resumen, agentes pendientes, checks por agente
  (`Checks`: logo + punto de estado) y un hilo desplegable («Ver respuestas», `useFullReviews`),
  con interruptor tarjetas/compacta.
- Ya existe todo lo que pide el usuario salvo el flujo: la página de detalle
  (`ChangeDetailPage`, ruta `/p/:slug/changes/:id`) con reviews, hallazgos, diff, acciones y
  reintento; la fila ámbar de commits deshechos/revertidos (`undoneNotice`, `UndoneStatusIcon`,
  `UndoneLabel`); los logos de agente (`AgentAvatar`); la lista de proyectos con refresco
  (`ProjectsContext`); las rutas con slug `owner/repo` (`lib/projectPath`, ruta `p/*`).
- La API no cambia: el listado de un proyecto ya trae reviews ligeras (agente, estado, nota,
  duración) y `commit_state`; `health().agentNames` da los agentes esperados.
- Suite de tests del frontend: Vitest + Testing Library; 10 ficheros nombran barra lateral, «Ver
  respuestas», «Compacta» o el redirect al primer proyecto.

## Goals / Non-Goals

**Goals:**
- Tres niveles con URL propia: `/` (proyectos) → `/p/:slug` (changes) → `/p/:slug/changes/:id`.
- Lista de una línea por change, con el estado de cada agente visible sin abrir nada.
- Reutilizar componentes y estilos vigentes; borrar lo que deja de usarse (hilo, densidad, barra
  lateral).

**Non-Goals:**
- Cambios de API o de backend (p. ej. contadores por proyecto en la entrada: la tarjeta no los
  muestra para no hacer N peticiones; se anota como mejora).
- Guardar filtros y búsqueda en la URL al volver desde el detalle: se usa el botón «atrás» del
  navegador o las migas; los filtros se reinician con las migas.
- Rediseñar Estadísticas, Ajustes, el detalle, los temas ni la PWA.

## Decisions

1. **Mantener las rutas** (`/`, `p/*`, `stats`, `settings`). Solo cambia lo que renderiza `/`
   (`ProjectPicker` en lugar de `FirstProject`). Alternativa descartada: nuevas rutas
   `/projects` o `/:owner/:repo`; rompe enlaces y `parseProjectPath` sin aportar nada.
2. **Barra superior única, sin cajón.** `Shell` pierde `<nav class="sidebar">`, el estado
   `open/channelsOpen`, el botón «Menú» y el velo; pasa a `[marca] [ProjectSwitcher] … [Estadísticas]
   [Ajustes] [tema]`. En estrecho, los enlaces son iconos (`aria-label`, el texto va en
   `.visually-hidden`). `ProjectsProvider` y «Añadir proyecto» siguen en el `Shell` (el diálogo se
   abre desde el selector de la entrada, el estado vacío y la última opción del selector de la
   barra).
3. **`ProjectSwitcher` = `<select>` nativo** con los proyectos (y «Añadir proyecto…» como última
   opción), visible solo si la ruta empieza por `/p/`. Nativo: accesible, teclado y móvil gratis,
   cero JS de menú. El valor se deriva de `parseProjectPath(useLocation())`.
4. **`ProjectPicker`**: rejilla de tarjetas `<a>` (`auto-fill`, mínimo 260 px) con el nombre,
   etiquetas (`Badge`) GitHub/Local/Hooks y la ruta en mono atenuado; última tarjeta «Añadir
   proyecto». Estados de carga, error (reintentar) y vacío con `AsyncBoundary`/`EmptyState`
   existentes.
5. **Fila compacta como enlace completo.** Cada `<li class="change">` contiene un solo `<a>`
   (título) cuyo `::after` cubre la fila (técnica «stretched link»): la fila entera es clicable y
   el único elemento enfocable es el enlace, sin enlaces anidados. Disposición con CSS grid:
   `[estado][tipo] título · #sha · autor · hace 2 h … [checks]`; en estrecho, los metadatos pasan a
   una segunda línea. Se borran `useFullReviews`, `summaryItems`, `PendingAgents` en la fila, el
   hilo, `Density` y `ReviewCard` de la lista (el detalle los conserva).
6. **`AgentChecks` (componente nuevo, `components/AgentChecks.tsx`).** Recibe `reviews` y
   `expected` (nombres esperados o `null`) y pinta un chip por agente: logo (`AgentAvatar`) + marca
   de estado — check (completada), aspa (fallida) y atenuado sin marca (en espera/en curso). Los
   agentes salen de la unión de `expected` y de las reviews del **run actual** (`splitRuns`);
   orden alfabético estable. Nombre accesible «Claude: completada», «Codex: en espera»; la forma
   (check/aspa/vacío) acompaña al color. Sustituye al `Checks` interno de `ChannelPage`.
7. **Amarillo = ámbar existente.** Se reutilizan `undoneNotice` y los tokens ámbar ya
   contrastados (`data-commit-state`); en la fila el texto «COMMIT DESHECHO/REVERTIDO» y su
   subtítulo van en línea, a la derecha del título. Se descarta introducir un amarillo nuevo
   (rompería el test de contraste y la coherencia de temas).
8. **Detalle.** `ChangeDetailPage` solo cambia las migas: «Proyectos» (`/`) / `slug`
   (`projectPath`) / `sha`. Todo lo demás se queda.
9. **Auto-actualización** sin cambios: `useChannel` y `useAsync` siguen haciendo el sondeo; el
   selector de proyectos reutiliza el de `ProjectsContext`.
10. **CSS**: se eliminan `.sidebar`, `.nav-*`, `.scrim`, `.menu-toggle`, `.list-box[data-density]`,
    `.thread`, `.review-summary` y la variante «tarjetas» de `.change-row`; se añaden `.topbar-nav`,
    `.project-switcher`, `.project-grid`/`.project-card` y la fila compacta. Cada nuevo estilo usa
    los tokens existentes (claro/oscuro).

## Risks / Trade-offs

- [Reescribir 10 ficheros de test es la parte cara] → se reescriben por comportamiento (rutas,
  roles y nombres accesibles), no por clases; los de `agentLogos`, `commitState`, `api`, `fx`
  conservan lo que sigue vigente.
- [La fila clicable entera compite con los controles internos] → no hay controles dentro de la
  fila (el hilo y su botón desaparecen); los checks son informativos.
- [Perder «Ver respuestas» sin abrir el detalle] → es lo pedido; el detalle carga rápido y se
  refresca solo mientras la review está en curso.
- [Sin contadores en las tarjetas de proyecto] → la entrada es más pobre pero no multiplica
  peticiones; mejora futura con un endpoint de resumen.
- [`<select>` nativo poco vistoso] → coherente con los temas gracias a `color-scheme` y a los
  tokens; se puede sustituir por un menú propio sin tocar rutas.

## Migration Plan

Rama `front-v2` desde `main`; no hay datos ni API que migrar. La PWA recoge la versión nueva con
el aviso «Actualizar» existente. Rollback: no fusionar la rama o `git revert` del merge.
