# 0008. Frontend estilo terminal retro

- Estado: Aceptada
- Fecha: 2026-10-25
- Sustituye a: [0003](0003-frontend-estetica-github-slack.md) y [0004](0004-efectos-libraries-dev.md)
- Deja sin efecto: [0005](0005-logos-de-agentes-y-reviews-legibles.md) (logos como avatar) y
  [0006](0006-logo-por-tema.md)

## Contexto

La interfaz creció por rondas sobre la estética de GitHub y Slack: dos temas, cuatro librerías de
efectos con WebGL, logos por tema y por agente, y 70 ficheros de test que acompañaban cada detalle
visual. El propietario del proyecto quiere una identidad propia, más simple de mantener y pensada
desde el móvil, sin tocar la API ni perder funcionalidad. El contrato OpenAPI tipado y la capa única
de acceso a datos permiten rehacer la presentación sin arrastrar cambios de backend.

## Decisión

- **Terminal retro, pero legible.** Un único tema: fondo `#0a0a0a`, texto `#33ff33`, secundario y
  bordes `#1f9d1f`, superficies `#0f3b0f` y un solo color de alerta, ámbar `#ffb000`. Todo como
  tokens CSS en `styles/tokens.css`; ningún valor de color o espaciado en los componentes.
- **Sans-serif para leer, monospace para decorar.** El cuerpo usa la pila del sistema
  (`Inter, system-ui, …`) a 16 px con interlineado 1,5. La monospace queda para títulos, prompts
  «$», badges, SHA, rutas y diff. Prohibidas las fuentes pixeladas y la monospace en párrafos,
  formularios y tablas.
- **Detalles sutiles y apagables.** Cursor parpadeante solo en el título de página, prefijo «>» en
  la navegación activa, bordes de 1 px en lugar de sombras y scanlines con opacidad menor de 0,05.
  Un interruptor en Ajustes y `prefers-reduced-motion` los desactivan. Contraste AA en todo el texto.
- **Sin librerías de efectos ni tema claro.** Se retiran `border-beam`, `img-fx`, `metal-fx`,
  `liquid-gooey`, `thinking-orbs` y `three`, el selector de tema, los logos de Duelo por tema y los
  logos de Claude y Codex como avatar. Los agentes se identifican con una etiqueta de texto
  monospace; la marca es el texto «$ duelo_». Los iconos de la PWA y los favicons se conservan.
- **Barra lateral en escritorio, cajón en móvil.** Mobile first con cortes en 480, 768, 1024 y
  1280 px; tablas a tarjetas o scroll controlado; formularios a una columna; controles de 44 px.
- **Organización por capas.** `components`, `pages`, `layouts`, `services` (toda la red), `hooks`,
  `utils`, `types` y `styles`; un componente por fichero; los componentes no hacen `fetch`.
- **Sin tests de frontend.** Decisión explícita del propietario: se eliminan Vitest, Testing Library
  y jsdom y el paso `pnpm test` del CI. La red de seguridad queda en `tsc` strict, Biome, el build y
  la comprobación de deriva del cliente generado.

## Consecuencias

- Bundle más pequeño y sin WebGL; funciona igual en cualquier navegador y sin conexión.
- Las capacidades `frontend-shell` y `project-browser` se actualizan con el change
  `frontend-terminal-retro`; los requisitos de orbes, brillo, anillo, héroe, temas y logos se retiran.
- Una regresión visual o de comportamiento en el front solo se detecta a mano: el change deja una
  lista de verificación de pantallas y llamadas, y el modo mock permite recorrer todos los estados.
- Cambiar la paleta o la tipografía es tocar un único fichero de tokens.
