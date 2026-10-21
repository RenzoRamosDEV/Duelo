# Spec Delta

## ADDED Requirements

### Requirement: Lectura del barrido acotada a los commits recientes
En cada barrido, el sistema SHALL leer como mucho `REACHABILITY_WINDOW_COMMITS` (5000 por defecto)
changes de tipo `commit` del proyecto, los de creación más reciente (desempate por id), el mismo
número que pide a git. Los changes que quedan fuera de esa lectura NO SHALL cambiar de marca en
ese barrido.

#### Scenario: Proyecto con 6000 commits
- **WHEN** un proyecto tiene 6000 changes `commit` y corre el barrido con la ventana por defecto
- **THEN** la lectura devuelve 5000 changes, los de creación más reciente

#### Scenario: Commit antiguo fuera de la lectura
- **WHEN** un change `commit` está fuera de los 5000 más recientes y su SHA ya no es alcanzable
- **THEN** el barrido no lo marca como deshecho ni emite ningún evento para él

#### Scenario: Menos commits que la ventana
- **WHEN** el proyecto tiene menos changes `commit` que la ventana
- **THEN** la lectura los devuelve todos, como hasta ahora
