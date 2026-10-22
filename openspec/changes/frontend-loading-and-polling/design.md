# Design

## Context

Motivación y línea base en `proposal.md` (precache 1980,86 KiB; chunk inicial 125,97 kB gzip;
`HeroImageFx` 593,91 kB). Lo que se ha comprobado en `frontend/src` y condiciona el enfoque:

- `useAsync(load, { pollMs, pollWhile, equals })` ya conserva el objeto anterior cuando `equals`
  dice que el refresco es igual, pero cada refresco hace `setUpdatedAt(Date.now())`: ese estado es
  lo que vuelve a renderizar la página cada 5 s. `refreshFailed` es otro `useState` del hook.
  `updatedAt` y `refreshFailed` salen en `AsyncResult` y solo los leen `ChannelPage` y
  `ChangeDetailPage` para pasarlos a `UpdatedAgo`.
- `useAsync` no cancela nada: ignora respuestas tardías con un flag `current`. `load` no recibe
  señal y los métodos de `DataSource` (`lib/api.ts`) tampoco la aceptan; `request` no tiene plazo
  y hace `response.json()` sin `try`.
- `ChangeDetailPage` calcula `splitRuns`, `parseDiff` y `diffFiles` dentro del *render prop* de
  `AsyncBoundary`, donde no se pueden usar hooks. Tras el reintento llama a `state.retry` (vuelve a
  «Cargando change…»). `App.tsx` monta `<ChangeDetailPage>` sin `key`, así que `note` sobrevive al
  cambiar de change.
- `ProjectsProvider` sondea con `usePollMs()` (5 s) y memoiza `value` sobre `projects`, que es un
  objeto nuevo en cada render (la memo no sirve). `refresh()` ya se llama tras añadir
  (`onAdded` del propio provider), quitar y cambiar agentes (`ProjectsSettings`): esa parte del
  objetivo ya se cumple y solo se fija con tests.
- `useChannel` pasa el mismo `pollMs` siempre; `isWaiting` (`lib/pending.ts`) ya define
  `pending`/`running`.
- `useAgentNames` (en `data/source.tsx`) hace un `useAsync(source.health)` por cada montaje.
- `createMockSource` vive en `data/source.tsx` y este importa `./mock` de forma estática; los tests
  la importan de `./source`.
- Los cuatro efectos ya son `lazy()` (`fx/HeroImage`, `fx/Beam`, `fx/MetalButton`, `ThemeSwitch`)
  con `Suspense`, pero su `import()` no tiene `catch`: si el chunk no está en caché y no hay red,
  el error sube sin *error boundary* y tumba la app.
- `Busy` importa `ThinkingOrb` de forma estática; los tests lo sustituyen con `vi.mock` y esperan
  el canvas de forma síncrona.
- `hasWebGL` crea un canvas y un contexto que no libera.
- Mutation testing: solo existe para el backend (`mutmut`, `just mutation`); el frontend no tiene
  herramienta.

## Goals / Non-Goals

**Goals:**
- Los objetivos medibles de `proposal.md` y los escenarios de las deltas.
- Ningún cambio visual ni de contrato HTTP.

**Non-Goals:**
- SSE, quitar dependencias de efectos, una librería de datos (TanStack Query, SWR: descartadas en
  el stack fijado).
- Cancelar «Cargar más» o las acciones de escritura (no sondean y su resultado se quiere ver).
- Introducir Stryker u otra herramienta de mutación para el frontend.

## Decisions

**Señal y plazo en `request`.** Los métodos de lectura de `DataSource` (`projects`, `changes`,
`change`, `agentStats`, `health`) aceptan un último argumento opcional `{ signal?: AbortSignal }`;
la fuente de ejemplo lo ignora. `request` combina `AbortSignal.any([signal, AbortSignal.timeout(
timeoutMs)])`, con `timeoutMs` = 10 000 por defecto e inyectable en `createHttpSource(baseUrl,
fetchImpl, { timeoutMs })` para que los tests usen tiempos reales cortos (los temporizadores falsos
no controlan `AbortSignal.timeout`). Al fallar: si venció el plazo → `ApiError("El servidor no
respondió a tiempo.", null)`; si abortó el llamante → se relanza el `AbortError`; si no → el
`ApiError` de conexión de hoy. `response.json()` en un 2xx va en `try`: un fallo que no es por la
señal → `ApiError("Respuesta no válida del servidor.", response.status)`. Alternativa descartada:
`signal` dentro de `ChangeQuery` (mezcla filtros con transporte y no sirve a los demás métodos).

**`useAsync` aborta.** `load` pasa a `(signal: AbortSignal) => Promise<T>` (los `() => ...`
actuales siguen tipando). Cada efecto (carga y sondeo) crea un `AbortController` y lo aborta en su
limpieza (desmontaje o cambio de `load`/`attempt`); un rechazo con la señal abortada se ignora:
ni estado ni `refreshFailed`. `inFlight` se libera en `finally`, así que tras un plazo vencido el
siguiente sondeo vuelve a intentarlo.

**Vivacidad fuera del estado de React.** `updatedAt` y `refreshFailed` pasan a un store pequeño por
instancia del hook (`createLiveness()` en `lib/`: `get()`, `set()`, `subscribe()`), creado con
`useRef` y expuesto como `AsyncResult.liveness` (referencia estable). `UpdatedAgo` recibe
`liveness` y lo lee con `useSyncExternalStore`; nada más lo lee. Así un refresco igual no toca el
estado de la página (el `setState(prev)` con `equals` ya hace *bail-out*). Se mueve también
`refreshFailed`, no solo la hora: si no, el paso de fallo a éxito seguiría re-renderizando la
página. Alternativa descartada: `ref` + `forceUpdate` en `UpdatedAgo` (reinventa
`useSyncExternalStore`).

**Memoización del detalle.** El contenido del *render prop* pasa a un componente `ChangeDetail({
change, ... })` dentro del mismo fichero, donde `useMemo` es posible: `rows`/`files`/totales sobre
`change.diff` y `splitRuns` sobre `[change.reviews, change.run]`, de modo que `FindingsPanel` recibe
la misma `reviews` mientras no cambien. `ChangeRow` con `React.memo` (sus props ya son estables:
el objeto del change se conserva gracias a `equals`, `agentNames` es el mismo array y `slug` un
string).

**Frecuencias como múltiplos del periodo base.** `lib/polling.tsx` exporta `IDLE_FACTOR = 6` y
`PROJECTS_FACTOR = 12`: con el periodo de producción (5 s) dan 30 s y 60 s, y los tests siguen
controlando todo con `PollingProvider`. `ProjectsProvider` usa `usePollMs() * PROJECTS_FACTOR` y
memoiza `value` sobre `status`, `data`/`error`, `retry`, `refresh` y `liveness`. En `useChannel`,
un `useState(true)` «hay algo en curso» se actualiza en un efecto con `items.some(c =>
isWaiting(c.reviewStatus))` (todos los cargados, también los de «Cargar más») y elige `pollMs` o
`pollMs * IDLE_FACTOR`; React descarta el `set` cuando no cambia. Cambiar `pollMs` solo reinicia el
intervalo (el efecto de sondeo es distinto del de carga), no recarga. Alternativa descartada:
`pollMs` como función de los datos en `useAsync` (obliga a cambiar `setInterval` por una cadena de
`setTimeout`, más superficie para lo mismo).

**Reintento silencioso y estado por change.** `onSettled` llama a `state.refresh` en vez de
`state.retry`; el refresco forzado ignora `pollWhile` y, como el run nuevo vuelve a `pending`, el
sondeo se reanuda solo. `ProjectRoute` monta `<ChangeDetailPage key={route.id} ...>`.

**Rutas diferidas.** `App.tsx` declara `StatsPage`, `SettingsPage` y `ChangeDetailPage` con
`lazy(() => import(...).then((m) => ({ default: m.X })))` (se conservan los *named exports*).
`Shell` envuelve `<Outlet />` en un único `<Suspense fallback={<Busy activity="load"
label="Cargando…" className="busy-block" />}>`. `ProjectPicker` y `ChannelPage` siguen estáticos.

**`thinking-orbs` diferido.** `Busy` usa `lazy(() => import("thinking-orbs").then((m) => ({
default: m.ThinkingOrb })))` dentro de `<Suspense fallback="…">`; con movimiento reducido no monta
el `lazy` (el «…» de siempre). Mismo hueco de 20 px, así que la maquetación no cambia.

**Fuente de ejemplo en su chunk.** `createMockSource` se muda a `data/mockSource.ts` (que importa
`./mock`). Sin `VITE_API_URL`, `source.tsx` crea `lazySource(() => import("./mockSource").then((m)
=> m.createMockSource()))`: un `DataSource` cuyos métodos esperan a la promesa (una sola, memoizada)
y delegan. El valor por defecto del contexto sigue siendo síncrono. Con `VITE_API_URL`, Rollup
elimina la rama y el chunk inicial no contiene los datos (`grep acme` = 0). Se adapta así el
objetivo «importar `./mock` de forma dinámica»: lo dinámico es `./mockSource`, que arrastra
`./mock`; `source.test.ts` importa `createMockSource` de `./mockSource`.

**Agentes configurados compartidos.** `useAgentNames` guarda la promesa de `source.health()` en un
`WeakMap<DataSource, Promise<string[]>>` a nivel de módulo (una por fuente, para que cada test con
su fuente empiece limpio) y la borra si rechaza, de modo que el siguiente montaje reintenta. El
hook usa `useAsync` sobre esa promesa compartida.

**Precache y caché en ejecución.** En `workbox`: `globIgnores` con `**/HeroImageFx-*.js`,
`**/MetalRing-*.js`, `**/BeamLayer-*.js`, `**/FluidThemeSwitch-*.js` y `**/pwa-*.png`, y una regla
`runtimeCaching` `CacheFirst` (caché `duelo-fx`, con `expiration.maxEntries` acotado) cuyo
`urlPattern` es una función que exige `sameOrigin` y la ruta de esos ficheros. Al ser solo del
mismo origen y solo estáticos con hash, no contradice «Los datos no se cachean».

**Efectos sin red, sin romper.** Los cuatro `lazy()` de efectos añaden `.catch(() => ({ default:
<versión estática> }))` (la `<img>`, el botón sin anillo, sin haz, el selector simple). Es una
línea por fichero fuera de la lista inicial de ficheros, necesaria para que excluir esos chunks del
precache no rompa «Abrir sin red».

**Sondeo WebGL.** `hasWebGL` llama a `gl.getExtension("WEBGL_lose_context")?.loseContext()` tras
obtener el contexto.

**Mutation testing.** El frontend no tiene herramienta y añadir Stryker (dependencia pesada, runner
propio para Vitest) queda fuera de alcance; se justifica en la tarea y se compensa con bordes
explícitos (plazo justo antes/después, `equals` igual/distinto, uno/ninguno `pending`, fallo y
reintento de la promesa compartida). Si se quiere mutación en el frontend, merece su propio change
y un ADR.

## Decisiones tomadas al implementar

Decisiones del apply, en modo autónomo, eligiendo la opción mínima:

- **Fuente de ejemplo: no se mueve (5.3 descartada).** La línea base (0.1) da `grep -c acme` = 0
  en `index-*.js` con `VITE_API_URL`: la condición `apiUrl ? createHttpSource(...) :
  createMockSource()` es constante en el build y Rollup ya elimina la fuente y los datos de
  ejemplo. `mockSource.ts` y `lazySource` solo separarían los datos en el build de demostración,
  que no tiene objetivo de tamaño (YAGNI). Sin `VITE_API_URL` los datos siguen en `index-*.js`.
- **Refresco igual: ni siquiera se llama a `setState`.** Con `setState(prev => prev)` React vuelve
  a ejecutar el componente antes de hacer *bail-out*, y el contador de renders de 2.2 lo detecta.
  `useAsync` compara con el estado mostrado (`latest.current`) y no encola nada si `equals` dice
  que es igual.
- **`ChangeRow` con comparador por valor.** Con la API real cada refresco trae objetos nuevos (JSON),
  así que un `React.memo` por referencia volvería a dibujar todas las filas en cuanto cambia una.
  El comparador usa `sameValue` sobre `change` y referencia sobre `slug` y `agentNames`. El fake
  del canal de `livePolling.test.tsx` devuelve copias para reproducirlo.
- **`Suspense` del shell con `key={pathname}`.** React Router navega dentro de una transición, y
  React mantiene la página anterior en vez de mostrar el *fallback* de un `Suspense` ya visible. La
  clave por ruta hace que cada página tenga su propio límite y «Cargando…» aparezca al llegar
  desde la barra superior (test de `Shell.test.tsx`). Las páginas ya se montaban de nuevo al
  cambiar de ruta, así que no se pierde estado.
- **Tests de efectos sin red en `src/features/fxOffline.test.tsx`.** Los `vi.mock` que hacen
  fallar los cuatro `import()` afectan a todo el fichero; ponerlos en `fx.test.tsx` habría roto
  sus tests, que necesitan los efectos reales. La versión estática de `HeroImageFx` es una `<img>`
  equivalente a la del componente (sin `data-variant`).
- **`hasWebGL` separa la prueba de la liberación.** `probe()` crea el contexto dentro del `try`;
  `loseContext()` va fuera, para que un fake o un contexto sin `getExtension` no convierta la
  respuesta en `false`. Los fakes de `HeroImage.test.tsx` y `MetalButton.test.tsx` añaden
  `getExtension` como un contexto real.
- **Agentes compartidos sin señal.** La promesa de `health()` se comparte entre montajes, así que
  no se le pasa la señal de ninguno: cancelarla por uno dejaría sin datos a los demás.
- **Tests con temporizadores falsos y rutas diferidas.** `livePolling.test.tsx` y
  `orbsPolling.test.tsx` importan `ChangeDetailPage` de forma estática para que el `import()` no
  dependa de E/S real mientras el reloj es falso. Los tests del orbe y de las páginas diferidas
  usan `vi.resetModules()` cuando necesitan ver el estado «aún no cargado».
- **Medida del objetivo de 107 kB.** El chunk `index-*.js` queda en 86,73 kB gzip. Contando los
  cinco chunks compartidos que `index.html` precarga, el arranque suma 109,40 kB. Se documenta en
  tasks.md (6.1) sin más cambios.

## Risks / Trade-offs

- [Los tests que esperan el orbe o una página diferida de forma síncrona fallan] → pasan a
  `findBy*`/`await`; en los de temporizadores falsos, `advanceTimersByTimeAsync` vacía las promesas
  del `import()`.
- [`AbortSignal.any`/`timeout` no existen en algún navegador antiguo] → disponibles en todos los
  navegadores actuales y en Node 22 (motor de `engines`); sin *polyfill*.
- [Un chunk de efecto que no está en caché y sin red] → versión estática por el `catch`.
- [`CacheFirst` sirve una versión vieja de un efecto] → los nombres llevan hash: una versión nueva
  es otra URL; `maxEntries` limita lo acumulado.
- [Iconos `pwa-*` fuera del precache] → el navegador los pide al instalar (con red) y quedan en
  `duelo-fx`; la instalación ya exige red.
- [107 kB gzip puede no alcanzarse] → se documenta el tamaño obtenido y su causa, sin más cambios.
- [`liveness` cambia la forma de `AsyncResult` (quita `updatedAt`/`refreshFailed`)] → interno al
  frontend; dos consumidores y sus tests.

## Migration Plan

Sin migración de datos. Al desplegar, el service worker nuevo sustituye al anterior por el flujo de
«Nueva versión disponible» y `cleanupOutdatedCaches` limpia el precache viejo. Rollback: revertir
los commits; la caché `duelo-fx` queda huérfana y sin efecto.

## Open Questions

Ninguna.
