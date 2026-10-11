---
name: change-hygiene
description: Higiene del commit o PR: mensaje coherente con el diff, atomicidad, contenido que no debe subirse, reglas desactivadas para pasar, lockfiles y CI tocados con cuidado.
---

**Mensaje del cambio**
- El título describe el efecto real del diff. Si el repositorio usa Conventional Commits, el tipo no miente: `feat` solo si cambia comportamiento observable, un cambio de tests es `test`, de tooling `chore`/`ci`; un `fix` sin test que reproduzca el fallo es sospechoso.
- Cabecera corta (la mayoría de linters la limitan a 72–100 caracteres); los detalles van en el cuerpo.

**Atomicidad**
- Un commit = un propósito. Mezclar refactor, funcionalidad y formateo oculta regresiones; es un hallazgo menor si no rompe nada.
- Un commit que por sí solo deja tests o build en rojo y necesita el siguiente para pasar complica la bisección; solo es bloqueante si el diff lo demuestra.
- Los lockfiles cambian con su manifiesto, no solos, y al revés.

**Contenido que no debe subirse**
- Secretos y credenciales, incluidos los «de ejemplo» en documentación (deben ser variables, no valores literales).
- Binarios, capturas, volcados, ficheros de entorno, cachés, salidas de herramientas, directorios de dependencias.
- Rutas absolutas de la máquina del autor, correos o datos personales en el contenido.

**Puertas del repositorio**
- Un cambio que desactiva una regla de lint, baja un umbral de cobertura o marca un test como omitido «para pasar» es importante salvo justificación escrita en el propio cambio.
- Un cambio de trazabilidad (spec, ADR, changelog) que el repositorio exige y el diff no trae, si se ve en el diff que existe esa convención.

**CI y automatizaciones**
- Acciones o imágenes fijadas por versión exacta o SHA, no por prefijo flotante; permisos mínimos declarados; secretos que no llegan a PRs de forks.

**Cómo confirmarlo.** El mensaje y el diff bastan para casi todo. Si puedes leer el repositorio, contrasta las convenciones (ficheros de configuración de commitlint, pre-commit, CI) antes de reportar una regla que quizá no existe.
