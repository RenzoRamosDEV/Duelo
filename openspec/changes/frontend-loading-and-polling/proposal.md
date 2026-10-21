# Proposal

## Por qué

En la primera visita el service worker precachea 1980,86 KiB, incluidos los efectos que solo se
cargan bajo demanda (`three` en el chunk `HeroImageFx` de 593,91 kB) y los iconos PNG de 512 px; el
chunk inicial pesa 125,97 kB gzip y lleva las cinco rutas, `thinking-orbs` y los datos de ejemplo
aunque la app use la API. En ejecución, las peticiones no tienen plazo (un sondeo colgado detiene
los refrescos sin avisar), un 200 que no es JSON escapa como `SyntaxError`, el canal y el detalle se
vuelven a renderizar (y el detalle vuelve a parsear el diff) cada 5 s aunque los datos no cambien, y
`/projects` se sondea cada 5 s en todas las páginas.

## Qué cambia

- **Precache.** Workbox deja fuera del precache los chunks `HeroImageFx-*`, `MetalRing-*`,
  `BeamLayer-*` y `FluidThemeSwitch-*` y los PNG `pwa-*`; se sirven con una regla `runtimeCaching`
  `CacheFirst` (mismo origen) y quedan offline tras su primer uso. Objetivo: precache ≤ 1000 KiB.
- **Code-splitting por ruta.** `StatsPage`, `SettingsPage` y `ChangeDetailPage` con `React.lazy` y
  un único `<Suspense>` en el shell que muestra `Busy` «Cargando…». El selector de proyectos y el
  canal siguen en el chunk inicial.
- **`thinking-orbs` diferido.** `Busy` lo importa de forma dinámica y, mientras llega (y siempre con
  movimiento reducido), muestra el «…» estático de hoy.
- **Datos de ejemplo en su chunk.** La fuente de ejemplo se importa de forma dinámica y solo sin
  `VITE_API_URL`; con la API configurada, el chunk inicial no contiene los datos de ejemplo.
- **Objetivo de tamaño.** Chunk JS inicial ≤ 107 kB gzip (antes 125,97 kB), construido con
  `VITE_API_URL`; se anotan los tamaños antes y después de cada chunk y, si no se alcanza, el tamaño
  obtenido y su causa.
- **Plazo y cancelación.** Toda petición a la API tiene un plazo de 10 s («El servidor no respondió a
  tiempo.», `status = null`) y se cancela al desmontar la página o cambiar su consulta, sin cambiar
  el estado ni marcar el refresco como fallido.
- **Respuesta no JSON.** Un 2xx que no es JSON da «Respuesta no válida del servidor.» con su status.
- **Sondeo sin re-render.** Un refresco con datos iguales no vuelve a renderizar la página: la hora
  de la última actualización vive en un store que solo lee `UpdatedAgo`; `ChangeRow` con
  `React.memo`; el diff y el reparto por runs del detalle, memoizados.
- **Frecuencias.** `/projects` cada 60 s (y al momento tras añadir, quitar o cambiar agentes); el
  canal cada 5 s mientras algún elemento cargado está `pending`/`running` y cada 30 s si ninguno; al
  volver a la pestaña, refresco inmediato como hoy.
- **Agentes configurados.** `useAgentNames` comparte una única petición por fuente durante la vida de
  la página; si falla, el siguiente montaje lo reintenta.
- **Reintento sin parpadeo y estado por change.** Tras «Reintentar review» el detalle se refresca en
  silencio (sin «Cargando», conservando diff, reviews y scroll); el detalle se monta por change, de
  modo que la nota de un reintento no aparece en otro.
- **Sondeo WebGL.** La comprobación de soporte libera su contexto de prueba con
  `WEBGL_lose_context`.

Fuera de alcance: sustituir el sondeo por SSE, quitar dependencias de efectos y cambiar el aspecto
visual.

## Capacidades

### Nuevas capacidades

(ninguna)

### Capacidades modificadas

- `pwa-install`: el *app shell* precacheado deja fuera los efectos diferidos y los iconos grandes,
  que se cachean tras su primer uso.
- `frontend-shell`: auto-actualización con frecuencias por página, sin re-render si nada cambia y
  con plazo; peticiones con plazo y respuesta no válida; páginas y orbe cargados bajo demanda;
  reintento silencioso y nota de reintento por change.

El chunk de ejemplo, los objetivos de tamaño, la memoización, la caché de agentes y la liberación
del contexto WebGL no cambian comportamiento observable: se verifican con tests y con la medición
del build, sin delta propia.

## Impacto

- Frontend: `vite.config.ts`, `src/App.tsx`, `src/layout/Shell.tsx`, `src/lib/{api,useAsync,
  polling}.ts(x)`, `src/components/{Busy,UpdatedAgo}.tsx`, `src/components/fx/webgl.ts`, los cuatro
  `lazy()` de efectos (`fx/{HeroImage,Beam,MetalButton}.tsx`, `ThemeSwitch.tsx`), `src/data/source.tsx`
  y un `src/data/mockSource.ts` nuevo, `src/features/channel/*`,
  `src/features/review/ChangeDetailPage.tsx`, `src/features/projects/ProjectsContext.tsx`, y los
  tests afectados.
- Contrato HTTP y `docs/openapi.json` sin cambios. Sin dependencias nuevas.
- Done-when: los escenarios de las deltas cubiertos por tests, precache ≤ 1000 KiB, chunk inicial
  ≤ 107 kB gzip (o la causa documentada), sin `acme` ni `thinking-orbs: gravity disabled after
  error` en `dist/assets/index-*.js`, y `just ci` en verde.
