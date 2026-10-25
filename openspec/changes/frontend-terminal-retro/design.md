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
- **Paleta**: `--bg #0a0a0a`, `--fg #33ff33`, `--fg-muted #1f9d1f`, `--surface #0f3b0f`,
  `--alert #ffb000`. El contraste de `#1f9d1f` sobre `#0a0a0a` es 5,4:1 y sobre `#0f3b0f` 3,9:1,
  así que el texto secundario sobre superficie usa `--fg` atenuado con opacidad calculada para
  mantener 4,5:1 (token `--fg-dim`). Los estados de review y severidades se expresan con forma e
  icono/texto además de color: ok en verde, fallo y crítico en ámbar, el resto en verde apagado.
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
- [Contraste del verde sobre verde oscuro] → tokens derivados calculados y comprobados con una
  fórmula WCAG en la pasada final; nunca `#1f9d1f` como texto sobre `--surface`.
- [Sin tests, regresiones silenciosas] → decisión explícita del encargo; mitigación: `tsc` strict,
  Biome, build en CI y recorrido manual en 375/768/1440 documentado en tasks.
- [Scanlines y parpadeo molestos] → opacidad < 0,05, interruptor y `prefers-reduced-motion`.
- [Drawer móvil accesible] → `<dialog>` nativo para el cajón, foco inicial en el primer enlace.

## Migration Plan

1. Rama `feat/frontend-terminal-retro`; commits atómicos por paso (estructura, componentes base,
   una pantalla por commit, tooling, docs).
2. Borrado de `frontend/src` y de los tests en el primer commit de implementación.
3. Rollback: revertir la rama; el backend y el contrato no cambian.
