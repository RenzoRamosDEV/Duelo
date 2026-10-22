# Tasks

Cada tarea sigue TDD con Vitest + Testing Library: primero el test en rojo (ejecutado y visto
fallar por el motivo esperado), después el código mínimo que lo pone en verde y, al final, el
refactor con los tests en verde. Todas las rutas son relativas a `frontend/`.

## 1. Mensaje de error de API compartido

- [ ] 1.1 Rojo (unit, `src/lib/apiErrorMessage.test.ts`): valor que no es `ApiError` → «Ocurrió un
      error inesperado.»; `ApiError` con `status === null` → su `message`; status presente en
      `overrides` → ese texto; 401 sin override → «Token de ingesta no válido.»; 401 con override →
      el override; status ausente (p. ej. 500) → `No se pudo ${action}: ${message}`; `overrides`
      vacío. Verde: `src/lib/apiErrorMessage.ts` según design D1.
- [ ] 1.2 Sustituir las tres `failureMessage` (`AddProjectDialog`, `RetryReview`,
      `ProjectsSettings`) por `apiErrorMessage` con sus `overrides` y acciones de hoy. Antes, añadir
      a los tests existentes (`src/features/localProjects.test.tsx` y
      `src/features/review/ChangeDetailPage.test.tsx`) los casos que falten para fijar el texto de
      cada status por formulario (alta: 404, 409, 422, 401, 500; reintento: 404, 503, 500; quitar:
      404, 500; sincronizar: 503 con motivo) y verlos en verde con el código de hoy; después del
      cambio siguen en verde. Verificación: `grep -rn failureMessage src` vacío.

## 2. Campo de token compartido

- [ ] 2.1 Rojo (componente, `src/components/TokenField.test.tsx`): renderiza el label «Token de
      ingesta» asociado a un input `type="password"` con `autocomplete="off"`; escribir actualiza
      `getIngestToken()`; sin `errorId` no tiene `aria-invalid` ni `aria-describedby`; con `errorId`
      tiene `aria-invalid="true"` y `aria-describedby` igual a ese id; el `ref` apunta al input.
      Verde: mover `TokenField` a `src/components/TokenField.tsx` (design D2).
- [ ] 2.2 `AddProjectDialog`, `RetryReview` y `ProjectsSettings` (diálogo de quitar y caja de la
      sección) usan `TokenField` en lugar de su input. Verificación: los tests existentes de alta,
      reintento, sincronizar y quitar siguen en verde; `grep -n 'type="password"' src/features`
      vacío.

## 3. Errores ligados al campo

- [ ] 3.1 Rojo (`src/features/localProjects.test.tsx`, alta): escenario «Token rechazado al añadir
      proyecto» (API 401 → input del token con `aria-invalid="true"`, `aria-describedby` con el id
      del `role="alert"`, y foco); escenario «Ruta relativa» (input de la ruta con
      `aria-invalid="true"`, `aria-describedby` con el id del aviso de hooks y el del error, foco, sin
      petición); token vacío → token marcado; 409 y 422 → ruta marcada; 404 → ningún input marcado;
      al abrir, ningún `aria-invalid`; al reenviar, el error y el atributo desaparecen mientras se
      envía. Verde: design D3 en `AddProjectDialog`.
- [ ] 3.2 Rojo (`src/features/review/ChangeDetailPage.test.tsx`, bloque «retry review»): escenario
      «Reintento sin token» (token marcado, describe el error, foco); 401 → token marcado y vacío;
      escenario «Error que no es de un campo» (503 → texto de hoy y ningún `aria-invalid`). Verde:
      D3 en `RetryReview`.
- [ ] 3.3 Rojo (`src/features/localProjects.test.tsx`, «project settings»): en el diálogo de quitar,
      token vacío y 401 → token marcado, describe el error, foco; 404 y 409 → ningún input marcado;
      los avisos por fila de sincronizar y guardar agentes no marcan el token de la caja. Verde: D3
      en `RemoveDialog`.

## 4. Diálogos con petición en vuelo

- [ ] 4.1 Rojo (`src/features/localProjects.test.tsx`): escenario «Escape durante el borrado» (con
      `removeProject` como promesa pendiente controlada por el test: Escape en el diálogo y el evento
      `cancel` no lo cierran, «Cancelar» está `disabled`; al resolver con error, «Cancelar» vuelve a
      estar habilitado y Escape cierra); escenario «Escape durante el alta» (lo mismo con
      `addProject`); escenario «Tras un fallo se puede cerrar». El test existente «closes on Escape
      or Cancel…» sigue en verde. Verde: prop `dismissible` en `Modal` (design D4) y
      `dismissible={!sending}` / `disabled={sending}` en ambos diálogos.

## 5. Tabla de estadísticas en móvil

- [ ] 5.1 Rojo (`src/features/stats/StatsPage.test.tsx`): escenario «Contenedor con scroll» (la
      `table` está dentro de un elemento con clase `table-scroll`). Verde: contenedor en
      `StatsTable`, regla `.table-scroll` en `src/styles/stats.css` y padding horizontal de 8 px en
      el `@media (max-width: 760px)` de `src/styles/responsive.css` (design D5).
- [ ] 5.2 Escenario «Viewport de 360 px» en el navegador (`pnpm dev` y Chrome, o Chrome headless,
      con viewport de 360 px en `/stats` con datos): `document.documentElement.scrollWidth <= 360` y
      la tabla se desplaza dentro de su contenedor. Anotar aquí el resultado.

## 6. Jerarquía de encabezados del detalle

- [ ] 6.1 Rojo (`src/features/review/FindingsPanel.test.tsx` y
      `src/features/review/ChangeDetailPage.test.tsx`): escenario «Niveles del panel de hallazgos»
      («Hallazgos» con `level: 3`; «x.py» y «Sin archivo» con `level: 4`); los asertos actuales con
      `level: 3` para los grupos pasan a `level: 4`. Verde: `h3`/`h4` en `FindingsPanel` y
      selectores de `src/styles/detail.css` (design D6). Comprobar en el navegador que el panel se
      ve igual (tamaño, peso y márgenes) en tema claro y oscuro.

## 7. Clase oculta única y código muerto

- [ ] 7.1 Rojo (componente, `src/components/FindingCard.test.tsx` y `FindingsPanel.test.tsx`): el
      `<output>` de `FindingCard` y la `legend` del filtro de severidad tienen la clase
      `visually-hidden`. Verde: cambiar la clase y borrar `.sr-only` de `src/styles/reviews.css`.
      Verificación: `grep -rn "sr-only" src` vacío.
- [ ] 7.2 Borrar `src/components/ui/Card.tsx` tras confirmar con
      `grep -rnE "ui/Card|from \"\./Card\"" src` que nadie lo importa (anotar resultado).
      Verificación: `pnpm typecheck` y `pnpm test` en verde.
- [ ] 7.3 Borrar `src/lib/reviewSummary.ts` y `src/lib/reviewSummary.test.ts` tras confirmar con
      `grep -rn "reviewSummary" src` que solo lo importa su test (anotar resultado). Verificación:
      `pnpm typecheck` y `pnpm test` en verde.
- [ ] 7.4 Mover `src/lib/contrast.ts` a `src/test/contrast.ts` tras confirmar con
      `grep -rn "contrast\"" src` que solo lo importa `src/styles/tokens.test.ts`, y actualizar ese
      import. Verificación: `src/styles/tokens.test.ts` en verde.
- [ ] 7.5 Corregir el comentario de `src/styles/update-prompt.css` para que no hable del «drawer and
      scrim» (design D7). Verificación: `grep -n "drawer\|scrim" src/styles/update-prompt.css`
      vacío.

## 8. Mutation testing

- [ ] 8.1 El frontend no tiene herramienta de mutación (`mutmut` solo cubre el backend) y añadir
      Stryker sería una dependencia pesada nueva fuera del alcance: no se ejecuta y se deja
      justificado aquí y en el PR. En su lugar, revisar que los tests de 1.1, 2.1, 3.1–3.3, 4.1 y
      6.1 cubren los bordes del diff (override presente/ausente y 401 con y sin override, `status`
      `null`, no `ApiError`; `errorId` presente/ausente; cada error asignado a token, ruta o ningún
      campo; `aria-describedby` con y sin texto de ayuda; `dismissible` verdadero/falso por Escape y
      por `cancel`; antes, durante y después de la petición; nivel 3 frente a 4) y anotar cualquier
      rama del diff sin test.

## 9. Verificación final

- [ ] 9.1 En `frontend/`: `pnpm test`, `pnpm typecheck`, `pnpm build` y `pnpm exec biome check .` en
      verde (anotar el número de tests).
- [ ] 9.2 En la raíz: `just lint` en verde; `docs/openapi.json` y `src/lib/api.generated.ts` sin
      cambios.
