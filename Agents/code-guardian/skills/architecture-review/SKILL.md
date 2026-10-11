---
name: architecture-review
description: Arquitectura del cambio: regla de dependencias entre capas, fugas de infraestructura en firmas, lógica de negocio en el borde, acoplamiento, puertos diseñados por adelantado y decisiones que contradicen las declaradas en el proyecto.
paths:
  - "*domain/*"
  - "*application/*"
  - "*adapters/*"
  - "*ports/*"
  - "*entrypoints/*"
  - "*services/*"
---

Juzga contra la arquitectura **declarada del proyecto** (documentación de arquitectura, decisiones registradas, contratos de imports), no contra una preferencia genérica. Si el diff se desvía de lo declarado, la pregunta es «¿hay una decisión escrita que lo justifique?», no «¿me gusta?».

**Regla de dependencias (arquitectura por capas o hexagonal)**
- El dominio no importa frameworks ni infraestructura (web, ORM, orquestador, HTTP).
- La capa de aplicación define casos de uso y puertos; depende solo del dominio.
- Adaptadores, puntos de entrada y workflows son capas hermanas: ninguna importa a otra; lo que comparten sube a la capa de aplicación o se inyecta desde la raíz de composición.
- Solo la raíz de composición conoce todas las capas, y no acumula lógica de negocio.

**Lo que un linter de imports no ve**
- Fugas de infraestructura por tipos: una sesión de base de datos, un cliente del orquestador o un modelo ORM en la firma de un caso de uso o de una entidad.
- Lógica de negocio en el borde: reglas (límites, recortes, decisiones) dentro de un router, un adaptador o una activity en vez de en dominio o aplicación.
- Dominio anémico o espejo de la tabla.
- Puertos que filtran el adaptador: excepciones o tipos del driver que cruzan el puerto sin traducirse.
- Puertos diseñados por adelantado: una abstracción con una sola implementación y sin segundo consumidor es candidata a sobrar.

**Principios como lente, no como dogma**
- Responsabilidad única: ¿se puede describir el módulo sin «y»?
- Extensión sin tocar el núcleo: ¿añadir una implementación nueva exige modificar el centro o solo registrar un adaptador?
- Interfaces pequeñas frente a repositorios todoterreno.
- Acoplamiento: cambios que obligan a editar muchos módulos a la vez; imports en círculo (aunque sean locales para evitarlo).
- Tests unitarios del núcleo que importan adaptadores rompen su aislamiento.

**Decisiones.** Un cambio que contradice una decisión vinculante del proyecto y no trae su justificación es importante. Si la decisión nueva es razonable, la salida correcta es pedir que se registre, no rechazar el cambio.

**Cómo confirmarlo.** Si puedes leer el repositorio, abre la documentación de arquitectura y el contrato de imports antes de reportar; si solo tienes el diff, limita el hallazgo a imports y firmas que el propio diff muestra.

**Salida.** Regla incumplida, import o firma exacta, coste concreto (qué se vuelve imposible de probar o de cambiar) y corrección mínima (mover, inyectar, extraer puerto).
