# Proposal

## Por qué

La interfaz ya tiene estados de carga, vacío y error, y respeta el movimiento reducido, pero quedan
defectos concretos de accesibilidad y de UX: los errores de los formularios no están ligados a su
campo (un lector de pantalla no sabe qué input falló y el foco no vuelve a él); los diálogos de
añadir y quitar proyecto se pueden cerrar con Escape o «Cancelar» con la petición en vuelo, y el
usuario cree que canceló algo que el servidor sigue haciendo; la tabla de estadísticas desborda la
página en móvil; y en el detalle «Hallazgos» es un `h2` dentro de la sección «Revisión de los
agentes», que también es `h2`. Además hay tres copias de `failureMessage`, dos inputs de token
copiados de `TokenField`, dos clases para ocultar texto (`.sr-only` y `.visually-hidden`) y código
muerto (`components/ui/Card.tsx`, `lib/reviewSummary.ts`).

## Qué cambia

- **Errores ligados al campo.** En `AddProjectDialog`, `RetryReview` y el diálogo de quitar proyecto
  de `ProjectsSettings`, cuando un error corresponde a un campo, su input lleva
  `aria-invalid="true"`, su `aria-describedby` incluye el id del texto de ayuda (si lo tiene) y el
  del mensaje de error, y recibe el foco al mostrarse el error. Sin error, `aria-invalid` no
  aparece.
- **Un solo mensaje de error de API.** Las tres funciones `failureMessage` se sustituyen por
  `apiErrorMessage` en `src/lib/`, con un mapa de textos por status HTTP; los textos que muestra
  cada formulario para cada status no cambian.
- **Un solo campo de token.** `TokenField` pasa de `ProjectsSettings.tsx` a `src/components/` y lo
  usan los tres formularios, con el label, el tipo `password` y el `autocomplete="off"` de hoy.
- **Diálogos con petición en vuelo.** Mientras se añade o se quita un proyecto, «Cancelar» está
  deshabilitado y Escape (y el evento `cancel` del `<dialog>`) no cierra el modal; `Modal` recibe
  una prop booleana `dismissible`. Al terminar la petición, vuelve el comportamiento de hoy.
- **Tabla de estadísticas en móvil.** `table.stats` va dentro de un contenedor con
  `overflow-x: auto`; por debajo de 760 px el padding horizontal de las celdas pasa a 8 px; a 360 px
  de viewport la página no tiene scroll horizontal, solo la tabla.
- **Jerarquía de encabezados.** «Hallazgos» pasa de `h2` a `h3` y los títulos de grupo (archivo) de
  `h3` a `h4`, sin cambio visual (las reglas CSS siguen al selector nuevo).
- **Una sola clase oculta.** `.sr-only` se elimina de `reviews.css` y sus dos usos pasan a
  `.visually-hidden` de `base.css`.
- **Código muerto.** Se borran `components/ui/Card.tsx` y `lib/reviewSummary.ts` (con su test);
  `lib/contrast.ts` se mueve a `src/test/` (solo lo usa `styles/tokens.test.ts`); se corrige el
  comentario de `styles/update-prompt.css`, que habla de un «drawer and scrim» que ya no existe.

Fuera de alcance: rediseñar la identidad visual, unificar las dos copias de la paleta clara de
`tokens.css` (el CSS las necesita: una para `[data-theme=light]` y otra para
`prefers-color-scheme`) y textos nuevos.

## Capacidades

### Nuevas capacidades

(ninguna)

### Capacidades modificadas

- `frontend-shell`: errores de formulario ligados a su campo; diálogos que no se cierran con una
  petición en vuelo; tabla de estadísticas que se desplaza dentro de su contenedor en pantallas
  estrechas; jerarquía de encabezados del panel de hallazgos.

`apiErrorMessage`, `TokenField` compartido, la clase oculta única y el código muerto no cambian
comportamiento observable (los textos y atributos son los de hoy): se verifican con los tests
existentes y nuevos, sin delta propia.

## Impacto

- Frontend: `src/components/{Modal,TokenField}.tsx` (`TokenField` nuevo),
  `src/lib/apiErrorMessage.ts` (nuevo), `src/features/projects/AddProjectDialog.tsx`,
  `src/features/review/{RetryReview,FindingsPanel}.tsx`,
  `src/features/settings/ProjectsSettings.tsx`, `src/features/stats/StatsPage.tsx`,
  `src/components/FindingCard.tsx`, `src/styles/{stats,responsive,reviews,detail,update-prompt}.css`,
  `src/test/contrast.ts` (movido desde `src/lib/`), `src/styles/tokens.test.ts`, y los tests
  afectados. Se borran `src/components/ui/Card.tsx` y `src/lib/reviewSummary{,.test}.ts`.
- Contrato HTTP, `docs/openapi.json` y backend sin cambios. Sin dependencias nuevas.
- Done-when: los escenarios de la delta cubiertos por tests de Testing Library, ningún test
  existente roto (salvo los que fijan el nivel de encabezado, que se actualizan), y `pnpm test`,
  `pnpm typecheck`, `pnpm build`, `pnpm exec biome check .` y `just lint` en verde.
