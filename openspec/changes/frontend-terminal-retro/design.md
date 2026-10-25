# Design

## Context

El front actual vive en `frontend/src` con carpetas `features/*`, `components/`, `lib/`, `data/`,
`styles/` y `test/`; toda la red pasa por `createHttpSource` en `lib/api.ts` sobre
`lib/api.generated.ts` (openapi-typescript). El resto del repo depende de tres cosas del front:
el script `gen:api` y la comprobación de deriva en CI, el build (`pnpm build`) en CI y `just test`,
y el hook `tsc` de pre-commit. Los ADR 0003 a 0006 fijan la estética actual y
`openspec/config.yaml` prohíbe sustituirla sin ADR. Ver proposal.md para la motivación.

## Goals / Non-Goals

**Goals:**
- Paridad funcional pantalla a pantalla y llamada a llamada con el front actual (inventario en la
  auditoría previa: 5 páginas, 404, 3 diálogos, 10 funciones de API).
- Una sola fuente de tokens, una sola capa de servicios, componentes base antes que pantallas.
- Legibilidad primero: sans-serif para lectura, monospace solo decorativo, AA en todo.
- Bundle más pequeño: sin WebGL ni librerías de efectos.

**Non-Goals:**
- Funcionalidad nueva (voto ciego, SSE, eventos, raw output). Siguen fuera.
- Tests de frontend de cualquier tipo.
- Cambios en la API, en el backend o en `docs/openapi.json`.

## Decisions

- **Estructura de carpetas**: `src/components` (base reutilizable y de dominio, un componente por
  fichero), `src/pages` (una por ruta), `src/layouts` (AppLayout con sidebar y drawer),
  `src/services` (http, mock, mapeo DTO → modelo, `api.generated.ts`), `src/hooks` (useAsync,
  polling, debounce, token), `src/utils` (formato, diff, markdown, severidades…), `src/types`
  (modelo de vista) y `src/styles` (`tokens.css`, `base.css`, `effects.css`). Alternativa: mantener
  `features/*` por dominio; se descarta porque el encargo pide la organización por capas.
- **Fichero generado en `src/services/api.generated.ts`**: se actualizan el script `gen:api`, la
  ignorada de Biome, `.gitattributes` y el paso de deriva del CI. Alternativa: dejarlo en `lib/`;
  se descarta para no conservar una carpeta solo por él.
- **Un único tema**: tokens en `:root`, `color-scheme: dark`, sin `data-theme` ni script previo al
  pintado. El `theme_color` del manifiesto y de `index.html` pasa a `#0a0a0a`. La preferencia
  `duelo-theme` que pudiera quedar en `localStorage` se ignora.
- **Tipografía**: cuerpo `Inter, system-ui, -apple-system, "Segoe UI", Roboto, sans-serif` a 16 px y
  `line-height 1.5`; mono `ui-monospace, "JetBrains Mono", Menlo, Consolas, monospace` solo en
  `h1`–`h3`, prompt, badges, SHA, rutas y diff. Sin descargar fuentes: la pila del sistema evita una
  dependencia de red y respeta la PWA sin conexión.
- **Paleta por jerarquía** (revisión del 2026-10-25): `--bg #0a0f0a`, `--bg-elev #0f1a0f`,
  `--bg-hover #152615`; texto `--fg-primary #d8ffd8`, `--fg-muted #7fbf7f` (8,9:1 sobre el fondo),
  `--fg-dim #4f9a4f` (el `#3f7a3f` pedido da 3,7:1 y no cumple AA como texto; `#4f9a4f` da 5,6:1
  sobre el fondo y 4,6:1 sobre `--bg-hover`), `--fg-accent #33ff33` solo para un acento por bloque;
  bordes `--border #1e4a1e` y `--border-hi` = acento en activo/hover/foco; semánticos
  `--ok` = acento, `--warn #ffb000` (en curso, commits deshechos, severidades medias), `--err
  #ff4d4d` (fallos, severidades graves), `--info #5fd3ff` (severidades menores). Los estados se
  expresan con glifo y texto además de color.
- **Escala tipográfica**: h1 22 px, h2 18 px, h3 15 px seminegrita, cuerpo 15 px, meta 13 px,
  etiqueta 11 px en mayúsculas con espaciado. Espaciado 4/8/12/16/24/32, radios 4–6 px,
  contenedor de 1200 px, transiciones de 150 ms como máximo.
- **Componentes base**: Button (primary, secondary, ghost, danger; 36 px en escritorio y 44 en
  táctil), Input, Chip/Badge (neutral, status, count), StatusIcon (✓ ● ✕ sin caja), Card, Table
  (cabecera 11 px, hover, flecha de orden solo en la activa), Segmented, Modal, Toast, Kbd,
  EmptyState, Skeleton, Loader y PageHeader. No se crean Select, Textarea ni Tooltip: ninguna
  pantalla los usa y el encargo pide cero código muerto.
- **Layout**: sidebar de 240 px con fondo elevado, activo con barra izquierda de 2 px y fondo
  hover, secciones con etiqueta de 11 px y pie con el estado de la conexión (derivado del
  diagnóstico ya compartido, sin peticiones nuevas) y acceso a Ajustes. Contenido con padding de
  32 px en escritorio y 16 en móvil.
- **Detalle a dos columnas**: en escritorio, pestañas Reviews / Hallazgos / Diff a la izquierda
  y una tarjeta de resumen (estado por agente, duración, nota) a la derecha; una columna en móvil.
  Es organización visual: los datos y las llamadas son los mismos.
- **Detalles retro**: cursor parpadeante solo en el `h1` de cada página (CSS `steps`), prefijo `>`
  en los enlaces de navegación activos, bordes de 1 px, scanlines en un pseudo-elemento fijo con
  `opacity 0.04` que se apagan con la clase `no-scanlines` (interruptor en Ajustes guardado en
  `localStorage`) y con `prefers-reduced-motion` junto con el parpadeo.
- **Navegación**: `AppLayout` con `<aside>` fijo de 240 px a partir de 1024 px y, por debajo, barra
  superior con botón «Menú» (`aria-expanded`) que abre el mismo `<aside>` como cajón con foco
  atrapado y cierre por Escape y por fondo. El `<aside>` lleva marca `$ duelo_`, enlaces Proyectos /
  Estadísticas / Ajustes y la lista de proyectos vigilados con «Añadir proyecto». Sustituye al
  `ProjectSwitcher`.
- **Estados de carga**: componente `Loader` con texto y un cursor `▌` parpadeante (estático con
  movimiento reducido), en línea en botones ocupados. Sustituye a los orbes.
- **Tablas**: `Table` base con `scroll horizontal controlado` por defecto y variante `cards` que en
  < 768 px pinta cada fila como tarjeta con etiquetas `data-label`. Estadísticas usa `cards`; el
  diff usa scroll horizontal.
- **Capa de datos**: se conserva el contrato `DataSource` (http y mock) y el `useAsync` con
  `pollMs`/`pollWhile`, pausa con pestaña oculta y comparación por valor; se reescriben con nombres
  nuevos pero el mismo comportamiento. Las constantes de sondeo (5 s, ×6 reposo, ×12 proyectos),
  el timeout de 10 s y los mensajes de error por código se copian literalmente de la auditoría.
- **Markdown y diff**: se reescriben los parsers propios (`utils/markdown.ts`, `utils/diff.ts`) con
  las mismas garantías (sin HTML, solo enlaces http(s), tope de 20 000 caracteres).
- **PWA**: misma configuración de `vite-plugin-pwa` sin la lista de chunks de efectos.

## Risks / Trade-offs

- [Pérdida de un detalle funcional al reescribir] → la auditoría de pantallas y llamadas es la lista
  de verificación; cada pantalla se revisa contra ella antes de cerrarla, y el modo mock permite
  recorrer todos los estados sin backend.
- [Contraste de los verdes apagados] → todos los pares texto/fondo se calculan con la fórmula
  WCAG antes de cerrar; `--fg-dim` se sube a `#4f9a4f` por eso.
- [Tarjetas de proyecto con «último change» y contadores] → el endpoint de proyectos no los trae
  y añadirlos exigiría una petición por proyecto; quedan fuera por la regla de no tocar la API.
- [Sin tests, regresiones silenciosas] → decisión explícita del encargo; mitigación: `tsc` strict,
  Biome, build en CI y recorrido manual en 375/768/1440 documentado en tasks.
- [Scanlines y parpadeo molestos] → opacidad < 0,05, interruptor y `prefers-reduced-motion`.
- [Drawer móvil accesible] → `<dialog>` nativo para el cajón, foco inicial en el primer enlace.

## Migration Plan

1. Rama `feat/frontend-terminal-retro`; commits atómicos por paso (estructura, componentes base,
   una pantalla por commit, tooling, docs).
2. Borrado de `frontend/src` y de los tests en el primer commit de implementación.
3. Rollback: revertir la rama; el backend y el contrato no cambian.
