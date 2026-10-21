# Spec Delta

## MODIFIED Requirements

### Requirement: Interfaz disponible sin conexión
El build de producción SHALL precachear el *app shell* mediante un service worker, de modo que la
aplicación abra y navegue entre sus rutas sin red tras la primera visita. Los efectos visuales que
se cargan bajo demanda (`HeroImageFx`, `MetalRing`, `BeamLayer`, `FluidThemeSwitch`) y los iconos
`pwa-*` SHALL NOT estar en el precache: SHALL guardarse en caché la primera vez que se usan y
servirse desde ella después, también sin red. El precache total del build SHALL ser como mucho de
1000 KiB.

#### Scenario: Abrir sin red
- **WHEN** el usuario abre la aplicación ya visitada sin conexión
- **THEN** se muestra la interfaz y, donde faltan datos, sus estados de error habituales

#### Scenario: Ruta de la SPA sin red
- **WHEN** el usuario recarga `/stats` sin conexión
- **THEN** se sirve la interfaz y la ruta se resuelve en el cliente

#### Scenario: Efecto ya usado sin red
- **WHEN** el usuario ya vio un estado vacío con su efecto WebGL y vuelve sin conexión
- **THEN** el efecto se sirve desde la caché sin pedirlo a la red

#### Scenario: Efecto nunca usado sin red
- **WHEN** la primera vez que hace falta un efecto no hay conexión
- **THEN** se muestra su versión estática (la imagen, el botón o el selector sin efecto) y la
  interfaz sigue funcionando

#### Scenario: Precache acotado
- **WHEN** se construye el build de producción
- **THEN** el precache que informa el build es como mucho de 1000 KiB (antes 1980,86 KiB) y no
  incluye los chunks de esos efectos ni los PNG `pwa-*`
