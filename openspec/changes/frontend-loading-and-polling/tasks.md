# Tasks

Cada tarea sigue TDD con Vitest + Testing Library: primero el test en rojo (ejecutado y visto
fallar por el motivo esperado), después el código mínimo que lo pone en verde y, al final, el
refactor con los tests en verde. Todas las rutas son relativas a `frontend/`.

## 0. Medición antes

- [x] 0.1 Antes de tocar código: `VITE_API_URL=http://localhost:8000 pnpm build` y anotar aquí el
      tamaño (bruto y gzip) de cada chunk de `dist/assets/*.js`, el precache que informa
      `vite-plugin-pwa` (línea base esperada: 1980,86 KiB; chunk inicial `index-*.js` 125,97 kB
      gzip; `HeroImageFx-*` 593,91 kB) y el resultado de
      `grep -c acme dist/assets/index-*.js` y
      `grep -c "thinking-orbs: gravity disabled after error" dist/assets/index-*.js` (esperado ≥ 1
      cada uno).

      **Medido (2026-10-21, `VITE_API_URL=http://localhost:8000 pnpm build`):**

      | Chunk | Bruto | Gzip |
      |---|---|---|
      | `index-*.js` (inicial) | 370,46 kB | 125,30 kB |
      | `HeroImageFx-*.js` | 593,91 kB | 150,51 kB |
      | `MetalRing-*.js` | 87,92 kB | 29,76 kB |
      | `BeamLayer-*.js` | 82,85 kB | 12,73 kB |
      | `FluidThemeSwitch-*.js` | 50,26 kB | 17,11 kB |
      | `workbox-window.prod.es5-*.js` | 5,65 kB | 2,20 kB |

      Precache: 21 entradas (1978,31 KiB). `grep -c acme` = 0 (no 1: Rollup ya elimina
      `createMockSource` con la API configurada; ver design.md) y
      `grep -c "thinking-orbs: gravity disabled after error"` = 1. El chunk inicial (125,30 kB) y
      el precache (1978,31 KiB) difieren levemente de la línea base de la propuesta (125,97 kB y
      1980,86 KiB) por cambios ya integrados.

## 1. Peticiones con plazo, cancelación y respuesta no válida

- [x] 1.1 Rojo (unit, `src/lib/api.test.ts`): con un `fetchImpl` que nunca resuelve y respeta la
      señal, `createHttpSource(url, fetchImpl, { timeoutMs: 20 })` rechaza con `ApiError` «El
      servidor no respondió a tiempo.» y `status === null`; bordes: responde a los 10 ms → datos;
      sin `timeoutMs` el plazo por defecto es 10 000 (se comprueba con un espía sobre
      `AbortSignal.timeout`); con la señal del llamante abortada → rechaza con `AbortError`, no con
      `ApiError`; fallo de red sin abortar → el mensaje de conexión de hoy. Verde: argumento
      `{ signal }` en las lecturas de `DataSource`, opción `timeoutMs` y
      `AbortSignal.any` en `request`.
- [x] 1.2 Rojo (unit, `api.test.ts`): escenario «Proxy que devuelve HTML» (`GET /projects` 200 con
      `<html>`) → `ApiError("Respuesta no válida del servidor.", 200)`; un 204 sigue devolviendo
      `undefined`; un 4xx con cuerpo HTML sigue dando «El servidor respondió N.». Verde: `try` sobre
      `response.json()` en los 2xx.
- [x] 1.3 Rojo (unit, `src/lib/useAsync.test.tsx`): el `load` recibe una `AbortSignal`; al
      desmontar y al cambiar `load` la señal de la carga en curso queda abortada y el estado no
      cambia; un refresco en curso abortado al desmontar no marca fallo; un `load` que rechaza por
      plazo en un refresco marca fallo y el siguiente sondeo vuelve a llamar a `load` (escenario
      «Servidor colgado», con temporizadores falsos y un `load` falso que rechaza). Verde:
      `AbortController` por efecto en `useAsync`.
- [x] 1.4 Rojo (página, `src/features/channel/ChannelPage.test.tsx`): escenario «Cambio de filtro
      con la petición en curso» (la primera petición recibe una señal que acaba abortada y no
      aparece ningún error); en `src/features/projects/ProjectPicker.test.tsx`, la fuente que
      rechaza con «Respuesta no válida del servidor.» muestra ese texto con «Reintentar». Verde:
      `useChannel`, `ChangeDetailPage`, `ProjectsProvider`, `StatsPage` y `SettingsPage` pasan la
      señal a la fuente; la fuente de ejemplo ignora el argumento.

## 2. Sondeo sin re-render

- [x] 2.1 Rojo (unit, `src/lib/liveness.test.ts` o junto al store nuevo): `get()` empieza en
      `{ updatedAt: null, refreshFailed: false }`; `set()` notifica a los suscritos solo si cambia
      algo; `unsubscribe` deja de notificar. Verde: `createLiveness()`.
- [x] 2.2 Rojo (unit, `useAsync.test.tsx`): con un contador de renders, un refresco cuyos datos son
      iguales según `equals` no vuelve a renderizar al consumidor y sí avanza
      `liveness.get().updatedAt`; uno distinto sí renderiza; un fallo seguido de éxito actualiza
      `refreshFailed` en el store sin renderizar si los datos son iguales; `liveness` mantiene la
      misma referencia entre renders y se reinicia con `retry`. Adaptar los tests que leían
      `updatedAt`/`refreshFailed` del resultado. Verde: `AsyncResult.liveness` y retirada de esos
      dos estados del hook.
- [x] 2.3 Rojo (componente, `src/components/UpdatedAgo.test.tsx`): `UpdatedAgo` con un `liveness`
      muestra «Actualizado hace…», el aviso de fallo y nada con `updatedAt` nulo, y se actualiza al
      cambiar el store sin que el padre se renderice. Verde: `useSyncExternalStore` en
      `UpdatedAgo`; `ChannelPage` y `ChangeDetailPage` le pasan `liveness`.
- [x] 2.4 Rojo (página, `src/features/livePolling.test.tsx`): escenario «Canal tranquilo» (50
      elementos `completed`, con `PollingProvider` de 1000 ms y 12 s visibles —el equivalente a
      60 s con el periodo de producción— → como mucho 2 peticiones tras la carga, y un espía sobre
      el render de las filas no registra ninguno tras la carga mientras los datos no cambian); un
      test unit fija `DEFAULT_POLL_MS × IDLE_FACTOR` = 30 000; un refresco con un elemento cambiado vuelve a dibujar
      solo esa fila. Verde: `React.memo` en `ChangeRow`.
- [x] 2.5 Rojo (página, `livePolling.test.tsx`): escenario «Canal con una review en curso»: con un
      elemento `running` el canal se pide cada periodo base; cuando pasa a `completed`, el siguiente
      intervalo es 6 × base; un elemento `pending` en una página de «Cargar más» también mantiene el
      periodo corto; al volver a la pestaña se refresca de inmediato en ambos casos. Verde:
      `IDLE_FACTOR` en `lib/polling.tsx` y el estado «hay algo en curso» en `useChannel`.

## 3. Detalle memoizado, reintento silencioso y estado por change

- [x] 3.1 Rojo (unit, `src/features/review/ChangeDetailPage.test.tsx`): con `parseDiff` espiado
      (`vi.mock` parcial de `lib/diff`), un refresco igual y un cambio de estado local (escribir en
      el campo del token) no vuelven a llamar a `parseDiff`; un `diff` nuevo sí; `FindingsPanel`
      (espiado) recibe la misma referencia de `reviews` mientras no cambien. Verde: componente
      `ChangeDetail` con `useMemo` sobre `change.diff` y sobre `[change.reviews, change.run]`.
- [x] 3.2 Rojo (página, `ChangeDetailPage.test.tsx`): escenario «Recarga sin parpadeo» (tras un
      202, nunca aparece «Cargando change…», el diff y las reviews siguen en el DOM y se hace una
      petición nueva del detalle); lo mismo tras un 409. Verde: `onSettled` llama a `refresh`.
- [x] 3.3 Rojo (página, `ChangeDetailPage.test.tsx` o `App.test.tsx`): escenario «Navegar a otro
      change» (nota «Reintento en marcha (run 2)» en A, se sigue el enlace a B, B no la muestra).
      Verde: `key={route.id}` en `ProjectRoute`.

## 4. Proyectos y agentes configurados

- [x] 4.1 Rojo (página, `livePolling.test.tsx`): escenario «Proyectos cada minuto» (con base de
      1000 ms, en 12 s se pide `/projects` una vez además de la carga; a los 11 s, ninguna);
      escenario «Proyecto añadido» (añadir, quitar y cambiar agentes provocan una petición
      inmediata; caracteriza lo que ya existe). Verde: `PROJECTS_FACTOR` en `ProjectsProvider`.
- [x] 4.2 Rojo (unit, `src/features/projects/ProjectPicker.test.tsx` o un test del provider): un
      consumidor de `useProjects` envuelto en `memo` no se vuelve a renderizar cuando el provider
      se renderiza sin cambio de `status`/`data`. Verde: `value` memoizado sobre esos campos.
- [x] 4.3 Rojo (unit, `src/data/source.test.ts` o un test nuevo de `useAgentNames`): tres
      componentes que montan `useAgentNames` sobre la misma fuente provocan una sola llamada a
      `health()`; dos fuentes distintas, una cada una; si la llamada rechaza, el siguiente montaje
      vuelve a llamar y, si acierta, el posterior ya no. Verde: `WeakMap` de promesas a nivel de
      módulo.

## 5. Carga diferida y precache

- [x] 5.1 Rojo (componente, `src/components/Busy.test.tsx`): escenario «Orbe aún no cargado»
      (antes de resolver el módulo se ve el «…» y la etiqueta; después, el canvas del orbe en el
      mismo `.busy-orb`); con movimiento reducido nunca se monta el orbe. Pasar a `findBy*` los
      tests de `Busy.test.tsx` y `src/features/orbs.test.tsx` que esperaban el canvas de forma
      síncrona. Verde: `lazy` + `Suspense` en `Busy`.
- [x] 5.2 Rojo (página, `src/layout/Shell.test.tsx`): escenario «Primera visita a Estadísticas»
      (la barra superior está y aparece «Cargando…» antes de la página); escenario «Entrada sin
      espera de código» (en `/` y en `/p/<slug>` no aparece «Cargando…» por código). Ajustar a
      `findBy*` los tests de Estadísticas, Ajustes y detalle que lo necesiten. Verde: `lazy` en
      `App.tsx` y un único `Suspense` en `Shell`.
- [x] 5.3 Rojo (unit, `src/data/source.test.ts` → `mockSource.test.ts`): `createMockSource` se
      importa de `data/mockSource`; los tests existentes siguen en verde; un test de `lazySource`
      comprueba que delega cada método tras resolver una sola vez el `import`. Verde: mover
      `createMockSource` y `lazySource` en `source.tsx` solo sin `VITE_API_URL`.
      **Descartada en Fase 0 (redundante, sin código):** la medición de 0.1 da `grep -c acme` = 0
      con `VITE_API_URL`; Rollup ya elimina `createMockSource` porque la rama del ejemplo es
      constante en el build con API. El motivo de la propuesta («lleva los datos de ejemplo aunque
      la app use la API») no se da, y mover la fuente solo separaría los datos en el build de
      demostración, que no tiene objetivo de tamaño. Decisión en design.md.
- [x] 5.4 Rojo (unit, `src/features/fx.test.tsx`): cada uno de los cuatro efectos, con su
      `import()` rechazado (`vi.mock` del módulo que lanza), muestra su versión estática sin error.
      Verde: `.catch` con la versión estática en los cuatro `lazy()`.
- [x] 5.5 Rojo (unit, test de `src/components/fx/webgl.ts`): con un `getContext` falso que devuelve
      un contexto con `getExtension("WEBGL_lose_context")` espiado, `hasWebGL()` llama a
      `loseContext()` una vez y conserva la respuesta en caché; sin la extensión no falla. Verde:
      liberar el contexto en `hasWebGL`.
- [x] 5.6 Precache (build, sin test de Vitest: es configuración de Workbox): `globIgnores` y regla
      `runtimeCaching` `CacheFirst` de mismo origen en `vite.config.ts`; verificar con
      `VITE_API_URL=http://localhost:8000 pnpm build` que el precache ≤ 1000 KiB, que
      `dist/sw.js` no lista `HeroImageFx-`, `MetalRing-`, `BeamLayer-`, `FluidThemeSwitch-` ni
      `pwa-` en el manifiesto de precache y sí contiene la regla de `runtimeCaching`. Comprobar a
      mano con `pnpm preview` el escenario «Efecto ya usado sin red» (DevTools → offline) y anotar
      el resultado.
      **Resultado:** precache 24 entradas (536,61 KiB) con `VITE_API_URL`; `dist/sw.js` no lista
      ninguno de `HeroImageFx-`, `MetalRing-`, `BeamLayer-`, `FluidThemeSwitch-` ni `pwa-` (0 cada
      uno) y contiene la regla `CacheFirst` de la caché `duelo-fx`. «Efecto ya usado sin red»:
      comprobado con `vite preview` y Chrome headless por CDP (equivalente al modo offline de
      DevTools): tras una visita con red, `duelo-fx` guarda `FluidThemeSwitch-*.js` y
      `pwa-192x192.png`; al recargar sin red, el selector fluido se monta, su chunk llega del
      service worker (200, `fromServiceWorker`) y ninguna carga falla.

## 6. Medición después

- [x] 6.1 `VITE_API_URL=http://localhost:8000 pnpm build` y anotar aquí, junto a los valores de
      0.1, el tamaño antes/después de cada chunk, el precache (objetivo ≤ 1000 KiB) y el chunk
      inicial (objetivo ≤ 107 kB gzip); `grep -c acme dist/assets/index-*.js` y
      `grep -c "thinking-orbs: gravity disabled after error" dist/assets/index-*.js` deben dar 0.
      Si el chunk inicial supera 107 kB, anotar el tamaño obtenido y su causa sin añadir más
      cambios. Comprobar también que `pnpm build` sin `VITE_API_URL` produce un chunk aparte con
      los datos de ejemplo y que `pnpm dev` sin API sigue mostrándolos.

      **Medido (2026-10-22, `VITE_API_URL=http://localhost:8000 pnpm build`):**

      | Chunk | Antes bruto / gzip | Después bruto / gzip |
      |---|---|---|
      | `index-*.js` (inicial) | 370,46 / 125,30 kB | 262,67 / 86,73 kB |
      | `jsx-runtime-*.js` (inicial, nuevo) | — | 8,77 / 3,33 kB |
      | `source-*.js` (inicial, nuevo) | — | 16,11 / 8,96 kB |
      | `ingestToken-*.js` (inicial, nuevo) | — | 23,01 / 8,79 kB |
      | `icons-*.js` (inicial, nuevo) | — | 3,41 / 1,05 kB |
      | `theme-*.js` (inicial, nuevo) | — | 1,11 / 0,54 kB |
      | `ChangeDetailPage-*.js` (diferido) | — | 23,17 / 8,21 kB |
      | `SettingsPage-*.js` (diferido) | — | 8,79 / 3,04 kB |
      | `StatsPage-*.js` (diferido) | — | 3,68 / 1,50 kB |
      | `format-*.js` (diferido) | — | 0,41 / 0,25 kB |
      | `index.es-*.js` (`thinking-orbs`, diferido) | — | 25,57 / 10,52 kB |
      | `HeroImageFx-*.js` | 593,91 / 150,51 kB | 593,95 / 150,53 kB |
      | `MetalRing-*.js` | 87,92 / 29,76 kB | 87,92 / 29,77 kB |
      | `BeamLayer-*.js` | 82,85 / 12,73 kB | 82,86 / 12,73 kB |
      | `FluidThemeSwitch-*.js` | 50,26 / 17,11 kB | 50,33 / 17,15 kB |
      | `workbox-window.prod.es5-*.js` | 5,65 / 2,20 kB | 5,65 / 2,20 kB |

      - Chunk inicial `index-*.js`: 86,73 kB gzip (objetivo ≤ 107 kB: **cumplido**).
      - JS de arranque completo (el `index` más los cinco chunks compartidos que `index.html`
        precarga): 109,40 kB gzip frente a los 125,30 kB del `index-*.js` de antes. **Supera
        107 kB en 2,40 kB**. Causa: al diferir las rutas, Rolldown saca a chunks compartidos el
        código que el shell comparte con ellas (`source`/`api`, los componentes agrupados en
        `ingestToken`, `jsx-runtime`, iconos y tema), y ese código se sigue cargando al arrancar.
        Sin más cambios, según lo acordado.
      - Precache: 24 entradas, 536,61 KiB (antes 1978,31 KiB; objetivo ≤ 1000 KiB: **cumplido**).
      - `grep -c acme dist/assets/index-*.js` = 0 y
        `grep -c "thinking-orbs: gravity disabled after error" dist/assets/index-*.js` = 0 (ese
        texto vive ahora en `index.es-*.js`, el chunk diferido del orbe).
      - Sin `VITE_API_URL` (`pnpm build`): los datos de ejemplo siguen en `index-*.js` (no hay chunk
        aparte, ver 5.3); `pnpm dev` sin API sigue mostrándolos (comprobado en Chrome headless:
        aparecen `duelo` y `acme/widgets`).

## 7. Mutation testing

- [x] 7.1 El frontend no tiene herramienta de mutación (`mutmut` solo cubre el backend) y añadir
      Stryker sería una dependencia pesada nueva fuera del alcance: no se ejecuta y se deja
      justificado aquí y en el PR. En su lugar, revisar que los tests de 1.1–1.3, 2.2, 2.5, 4.1 y
      4.3 cubren los bordes del diff (plazo antes/después, señal del llamante frente a plazo,
      `equals` igual/distinto, uno/ninguno en curso, 11 s frente a 12 s, promesa fallida y
      reintentada) y anotar cualquier rama del diff sin test.

      **Revisado:** cubiertos plazo vencido frente a respuesta a los 10 ms con plazo de 200 ms,
      plazo por defecto 10 000, señal del llamante frente a plazo frente a fallo de red, 2xx no
      JSON frente a 204 y 4xx HTML, carga y refresco abortados, `equals` igual/distinto (con
      contador de renders), un elemento en curso/ninguno/uno `pending` en «Cargar más», 11 s frente
      a 12 s, y promesa de agentes fallida, reintentada y acertada. Ramas del diff sin test propio:
      (a) en `request`, el abort (del llamante o del plazo) mientras se lee el cuerpo JSON de un
      2xx; (b) en `useChannel`, conservar el periodo mientras la consulta nueva aún carga
      (`if (base)`); (c) en `hasWebGL`, el `catch` de `probe` cuando `getContext` lanza (ya existía
      antes del cambio). Las tres son de bajo riesgo y no se añaden tests extra.

## 8. Verificación final

- [x] 8.1 En `frontend/`: `pnpm test`, `pnpm build`, `pnpm typecheck` y `pnpm exec biome check .`
      en verde.
      **Resultado:** `pnpm test` 71 ficheros, 725 tests en verde; `pnpm typecheck` sin errores;
      `pnpm build` correcto (precache 536,33 KiB sin `VITE_API_URL`); `pnpm exec biome check .`
      181 ficheros sin cambios.
- [x] 8.2 En la raíz: `just lint` y `just test-unit` en verde; `docs/openapi.json` y
      `src/lib/api.generated.ts` sin cambios.
      **Resultado:** `just lint` sale 0 (contratos de capas 1 kept, 0 broken; biome sin cambios);
      `just test-unit` 1385 passed; `docs/openapi.json` y `src/lib/api.generated.ts` sin cambios.