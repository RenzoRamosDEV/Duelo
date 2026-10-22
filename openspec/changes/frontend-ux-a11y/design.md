# Design

## Context

Motivación en `proposal.md`; comportamiento en `specs/frontend-shell/spec.md`. Lo comprobado en
`frontend/src` (sobre el estado que deja `frontend-loading-and-polling`) y que condiciona el
enfoque:

- `failureMessage` existe tres veces: `features/projects/AddProjectDialog.tsx` (404, 409, 422, 401,
  `null`, por defecto «No se pudo añadir el proyecto: …»), `features/review/RetryReview.tsx` (401,
  404, 503, `null`, por defecto «No se pudo reintentar: …») y
  `features/settings/ProjectsSettings.tsx` (`failureMessage(error, action)`: 401, 404, `null`, por
  defecto «No se pudo ${action}: …», usado en quitar, sincronizar y guardar agentes). Las tres
  comparten «Ocurrió un error inesperado.» para lo que no es `ApiError`, `error.message` para
  `status === null` y «Token de ingesta no válido.» para 401. Dos casos de `ProjectsSettings` usan
  el mensaje del servidor en el texto (409 al quitar, 422 al guardar agentes) y se resuelven antes
  de llamar a `failureMessage`.
- `TokenField({ id })` es una función local de `ProjectsSettings.tsx` (label «Token de ingesta»,
  `type="password"`, `autoComplete="off"`, lee y escribe con `useIngestToken()`), usada en el diálogo
  de quitar y en la caja de la sección. `AddProjectDialog` y `RetryReview` copian el mismo input a
  mano. Ninguno de los tres inputs de token tiene hoy texto de ayuda; el único campo con ayuda es la
  ruta de `AddProjectDialog` (`aria-describedby={hintId}`, el párrafo de los hooks).
- Los errores se guardan como `string | null` y se pintan en `<p className="notice" role="alert">`
  sin id; ningún input lleva `aria-invalid`.
- `components/Modal.tsx` cierra con Escape en `onKeyDown` (con `preventDefault`) y en `onCancel`
  (con `preventDefault` y `onClose()`); no tiene forma de impedir el cierre. Su test vive en
  `features/localProjects.test.tsx` («closes on Escape or Cancel…»), igual que los del alta y la baja.
  En `RemoveDialog` el foco inicial está en «Cancelar» (`data-autofocus`), y ese botón no se
  deshabilita nunca; en `AddProjectDialog` tampoco. `sending` ya existe en ambos.
- `table.stats` (`features/stats/StatsPage.tsx`) se renderiza suelta; `styles/stats.css` le pone
  `width: 100%`, `overflow: hidden` y padding `10px 16px`. `styles/responsive.css` tiene un único
  `@media (max-width: 760px)`. La única clase de solo scroll horizontal es `.diff-scroll` en
  `styles/detail.css`.
- En el detalle (`ChangeDetail` dentro de `ChangeDetailPage.tsx`) la jerarquía es `h1` título → `h2`
  «Revisión de los agentes» → `FindingsPanel` con `h2` «Hallazgos» y `h3` por archivo. Las reglas son
  `.findings > h2, .findings-head h2` y `.finding-group h3` en `styles/detail.css`; `base.css` solo
  da estilo de base a `h1`–`h3` (peso 600, `line-height: 1.25`). Fijan el nivel 3 de los grupos
  `FindingsPanel.test.tsx` y `ChangeDetailPage.test.tsx` (`within(panel)…{ level: 3 }`).
- `.sr-only` (`styles/reviews.css`) se usa en `components/FindingCard.tsx` (`<output>`) y
  `features/review/FindingsPanel.tsx` (`<legend>`); `.visually-hidden` (`styles/base.css`) es
  equivalente (`clip: rect(0 0 0 0)` frente a `rect(0, 0, 0, 0)`).
- Código muerto confirmado con búsqueda de imports: `components/ui/Card.tsx` no lo importa nadie (las
  coincidencias de «Card» son `ReviewCard`, `FindingCard` y `stat-card`, y no hay regla `.card`);
  `lib/reviewSummary.ts` solo lo importa `lib/reviewSummary.test.ts`; `lib/contrast.ts` solo lo
  importa `styles/tokens.test.ts`. `styles/update-prompt.css` dice «Pinned above the drawer and
  scrim»: la app ya no tiene cajón lateral.

Todo lo del alcance sigue aplicando; no se excluye ningún punto.

## Goals / Non-Goals

**Goals:**

- Cerrar la delta de `frontend-shell` con el menor cambio de estructura posible.
- Quitar duplicados sin cambiar textos, atributos ni estilos visibles.

**Non-Goals:**

- Ligar a un campo los mensajes por proyecto de la caja «Proyectos vigilados» (sincronizar PRs,
  guardar agentes): no son errores de un formulario con su campo, sino avisos de la fila del proyecto
  aunque nombren el token. La caja usa `TokenField` sin estado de error.
- Deshabilitar el input del token o «Reintentar review» más allá de lo que ya hacen.
- Arreglar el salto `h2` → `h4` de `ReviewCard` («Resumen», «Hallazgos» de la tarjeta): no es parte
  del panel; queda como seguimiento.
- Añadir Stryker u otra herramienta de mutación al frontend.

## Decisions

### D1. `apiErrorMessage(error, overrides, action)` en `src/lib/apiErrorMessage.ts`

Firma: `apiErrorMessage(error: unknown, overrides: Partial<Record<number, string>>, action: string)`.
Orden: no `ApiError` → «Ocurrió un error inesperado.»; `status === null` → `error.message`; status
en `overrides` → ese texto; 401 → «Token de ingesta no válido.» (común a los tres, se puede
sobrescribir); resto → `No se pudo ${action}: ${error.message}`. Cada formulario declara un objeto
`const` con sus textos de hoy (`AddProjectDialog`: 404, 409, 422; `RetryReview`: 404, 503;
`ProjectsSettings`: 404) y su acción («añadir el proyecto», «reintentar», «quitar el proyecto» /
«sincronizar las PRs» / «guardar los agentes»).

- Alternativa: `overrides` como único argumento con el texto por defecto dentro. Descartada: el texto
  por defecto lleva el mensaje del servidor y la acción, que varían por llamada.
- Alternativa: valores de `overrides` como función `(error) => string` para cubrir el 409 de quitar
  y el 422 de agentes. Descartada (YAGNI): son dos casos, ya resueltos antes de la llamada con un
  ternario legible; se dejan como están.

### D2. `TokenField` en `src/components/TokenField.tsx`

Props: `id`, `errorId?: string` y `ref?: Ref<HTMLInputElement>` (React 19 pasa `ref` como prop, sin
`forwardRef`). Con `errorId`, el input lleva `aria-invalid="true"` y `aria-describedby={errorId}`;
sin él, ninguno de los dos. Lee y escribe el token con `useIngestToken()` como hoy; los formularios
siguen leyendo el valor con su propio `useIngestToken()` (es un store compartido). Sin prop de ayuda:
ningún campo de token tiene texto de ayuda hoy (YAGNI); si llega, se añade `hintId`.

### D3. Error con campo: `{ text, field }` y foco en un efecto

Cada formulario guarda `error: { text: string; field: "path" | "token" | null } | null` en lugar de
`string | null`, da al `<p role="alert">` un id de `useId()` y pasa ese id al input afectado
(`aria-describedby` de la ruta = `hintId` + id del error; el de token, vía `errorId`). Un
`useEffect` sobre `error` enfoca el input del campo con un `ref`. Asignación (spec): token ←
token vacío o 401; ruta ← ruta no absoluta, 409 o 422 al añadir; el resto, `null`.

- Alternativa: enfocar en el `catch` directamente. Descartada: el input aún no tiene los atributos
  nuevos hasta el siguiente render; el efecto enfoca ya con el DOM actualizado.
- 401 vacía el token (`clearIngestToken`); el input queda vacío, marcado y enfocado, que es lo que se
  quiere para volver a escribirlo.

### D4. `Modal` con `dismissible` (por defecto `true`)

Con `dismissible={false}`, Escape en `onKeyDown` hace `preventDefault` sin llamar a `onClose`, y
`onCancel` hace `preventDefault` sin llamar a `onClose`. `AddProjectDialog` y `RemoveDialog` pasan
`dismissible={!sending}` y `disabled={sending}` a «Cancelar». Por defecto `true`: los usos
existentes no cambian.

- Alternativa: que `Modal` reciba `busy` y deshabilite él los botones. Descartada: `Modal` no conoce
  sus botones; la prop mínima es la que pide el comportamiento.

### D5. Contenedor `.table-scroll` en `styles/stats.css`

`StatsTable` envuelve la tabla en `<div className="table-scroll">` con `overflow-x: auto` y
`max-width: 100%`. En `responsive.css`, dentro del `@media (max-width: 760px)` existente,
`table.stats th, table.stats td { padding-left: 8px; padding-right: 8px; }`.

- Alternativa: reutilizar `.diff-scroll`. Descartada: su nombre y su fichero (`detail.css`) son del
  diff; usarlo en estadísticas acopla dos páginas por un nombre engañoso. Renombrarla a una clase
  genérica tocaría el diff, fuera de alcance. La regla nueva es de una línea.
- `table.stats` mantiene `overflow: hidden` (recorta las esquinas redondeadas); el desplazamiento lo
  da el contenedor. No se fija `min-width` en la tabla: la tabla comprime sus columnas mientras su
  contenido lo permite y solo desborda (y se desplaza dentro del contenedor) cuando ya no cabe.

### D6. Encabezados: `h3` «Hallazgos», `h4` por archivo

Selectores nuevos en `styles/detail.css`: `.findings > h3, .findings-head h3` y
`.finding-group h4`. Como `base.css` no estiliza `h4`, la regla de `h4` añade `font-weight: 600` y
`line-height: 1.25` para igualar el `h3` de hoy (tamaño 13 px y margen ya los fija la regla). Se
actualizan los tests que fijan `level: 3` en el panel a `level: 4`.

### D7. Clase oculta única y código muerto

- `.sr-only` sale de `reviews.css`; `FindingCard` y `FindingsPanel` usan `.visually-hidden`.
- Antes de cada borrado o movimiento, `grep` de imports en `frontend/src` (resultado anotado en la
  tarea). `src/test/contrast.ts` sigue el mismo nombre; solo cambia el import de `tokens.test.ts`.
- El comentario de `update-prompt.css` pasa a decir por qué el aviso va fijo y por encima del resto
  de la interfaz, sin mencionar el cajón.

### D8. Verificación de 360 px

jsdom no calcula layout: el test de Testing Library comprueba que la tabla está dentro de
`.table-scroll`. La ausencia de scroll horizontal de la página a 360 px se comprueba a mano en el
navegador (o Chrome headless, como en el change anterior) con
`document.documentElement.scrollWidth <= 360` y se anota en la tarea.

## Risks / Trade-offs

- [Chrome fuerza el cierre de un `<dialog>` si el `cancel` se cancela repetidamente sin activación
  del usuario] → `onKeyDown` ya hace `preventDefault` de Escape antes de que se genere la petición de
  cierre, así que en la práctica `cancel` no llega; se prueba en el navegador además de en jsdom.
- [Con «Cancelar» y el botón de envío deshabilitados, el foco que estaba en ellos se pierde] → el
  foco sigue dentro del diálogo (el input del token sigue habilitado y Tab lo encuentra); al
  terminar con error, el foco va al campo del error (D3) o se queda donde estaba.
- [Los tests que fijan el nivel 3 en el panel cambian] → se cambian en la misma tarea que el
  componente, con el rojo visto antes.
- [Mover `TokenField` cambia el orden de hooks de los formularios] → sin estado nuevo propio salvo
  `useIngestToken`, que ya era compartido; cubierto por los tests de alta, reintento y baja que ya
  existen.

## Migration Plan

Solo frontend, sin datos ni contrato. Despliegue con el build normal; rollback revirtiendo los
commits del change.
