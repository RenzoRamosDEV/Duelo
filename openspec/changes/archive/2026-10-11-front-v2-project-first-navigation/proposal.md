# Proposal

## Why

Hoy el frontend abre directamente el primer proyecto, con una barra lateral de canales, tarjetas
grandes por change y un hilo desplegable con las respuestas de los agentes dentro de la propia
lista. Es denso y mezcla niveles: elegir proyecto, ojear commits y leer una review ocurren en la
misma pantalla. El usuario quiere un cambio radical hacia un flujo en tres niveles, más compacto
y ordenado: **elegir proyecto → ver sus commits y PRs → abrir uno en su propia página**.

## What Changes

- **Entrada = selector de proyectos** (`/`): una lista de tarjetas con los proyectos vigilados
  (nombre `owner/repo`, etiquetas GitHub/local/hooks y ruta) y «Añadir proyecto». Ya no se
  redirige al primer proyecto. Sin proyectos, el estado vacío actual.
- **Se elimina la barra lateral.** La barra superior lleva la marca, un selector del proyecto
  actual (para saltar a otro sin pasar por la entrada), Estadísticas, Ajustes y el tema. En
  pantallas estrechas los enlaces se reducen a iconos; ya no hay cajón ni botón «Menú».
- **Página del proyecto** (`/p/:slug`): lista **compacta** de sus changes (commits y PRs), una
  fila por change: icono de estado, tipo, título, `#sha`, autor, antigüedad y, a la derecha, un
  **check por agente** con su logo (Claude, Codex u otro) y su estado: respondió (check), falló
  (aspa) o en espera. Los commits **revertidos o deshechos** se pintan en **amarillo** con su
  etiqueta. Se mantienen búsqueda, filtro por tipo, pestañas de estado, «Cargar más», contadores y
  el refresco automático. Desaparecen el hilo desplegable («Ver respuestas»), las insignias de
  resumen y el interruptor tarjetas/compacta (la lista es siempre compacta).
- **Toda la fila es un enlace** a la **página del change** (`/p/:slug/changes/:id`), que ya
  existe y concentra la información completa (estado, reviews por agente, hallazgos, diff,
  acciones, reintento); su migas pasan a «Proyectos / proyecto / sha».
- Se mantienen API, voto/estados existentes, temas, PWA y todo lo de Estadísticas y Ajustes.
- **BREAKING** (solo interfaz): se retiran los requisitos de barra lateral, hilos desplegables,
  vista compacta/tarjetas y respuestas del canal en `frontend-shell`; sus comportamientos
  vigentes pasan a la capacidad nueva `project-browser`.

## Capabilities

### New Capabilities
- `project-browser`: navegación proyecto → changes → detalle: selector de proyectos como entrada,
  barra superior con selector de proyecto, lista compacta con checks por agente y commits
  deshechos o revertidos en amarillo, y fila enlazada al detalle en página propia.

### Modified Capabilities
- `frontend-shell`: se retiran los requisitos de la barra lateral y del hilo desplegable y se
  ajustan los que los nombran (contraste, alta de proyecto, auto-actualización, agentes
  pendientes, commits deshechos).

## Impact

- Código (`frontend/src`): `App.tsx`, `layout/Shell.tsx` (barra superior y selector de proyecto),
  nueva `features/projects/ProjectPicker.tsx`, `features/channel/ChannelPage.tsx` (lista
  compacta; sin hilo ni densidad), `features/review/ChangeDetailPage.tsx` (migas),
  `components/AgentChecks.tsx` (nuevo), `index.css`.
- Tests: los que ejercitan barra lateral, «Ver respuestas», «Compacta» o el redirect al primer
  proyecto (10 ficheros) se reescriben contra el flujo nuevo; tests nuevos del selector, del
  selector de la barra superior y de los checks.
- Docs: `frontend/README.md`, `docs/architecture.md`, `docs/testing.md`.
- Sin cambios en la API, la base de datos ni el backend. Rama `front-v2`.
