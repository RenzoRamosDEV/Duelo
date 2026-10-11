---
name: dependency-and-config-audit
description: Dependencias y configuración: manifiestos y lockfiles coherentes, paquetes nuevos y saltos de versión mayor, separación prod/dev, variables de entorno, Dockerfiles y compose, workflows de CI/CD y task runners.
paths:
  - "pyproject.toml"
  - "*/pyproject.toml"
  - "*.lock"
  - "*lock.yaml"
  - "*lock.json"
  - "package.json"
  - "*/package.json"
  - "Dockerfile*"
  - "*/Dockerfile*"
  - "*compose*.yml"
  - "*compose*.yaml"
  - ".github/*"
  - "*.toml"
  - "*.env*"
  - "justfile"
  - "Makefile"
  - ".pre-commit-config.yaml"
---

Comprueba la compatibilidad antes de recomendar una actualización: el rango que aceptan los demás paquetes y los mínimos de runtime que el propio proyecto declara en sus manifiestos. Recomendar «la última» sin mirar es un hallazgo malo.

**Dependencias**
- Manifiesto y lockfile coherentes: si cambia uno, cambia el otro.
- Lockfile grande: no lo leas línea a línea. Revisa solo los paquetes nuevos (nombre, mantenedor, necesidad) y los saltos de versión mayor; el resto es ruido.
- Rangos: mínimos realistas, sin comodines totales, sin fijar a la versión exacta en librerías salvo motivo.
- Separación prod/dev: herramientas de test o lint nunca en las dependencias de ejecución.
- Necesidad: una dependencia nueva para algo que la biblioteca estándar o una ya presente resuelven; tamaño, mantenimiento, licencia, nombres parecidos a paquetes conocidos.
- Una subida de versión mayor exige evidencia: notas de la versión y que el diff traiga los ajustes que piden.
- Pares: frameworks y sus plugins compatibles entre sí.

**Configuración y entorno**
- Las variables obligatorias fallan rápido con mensaje claro; toda variable nueva está en la configuración central, documentada y con valor por defecto seguro o ausente. Todo lugar que arranque la aplicación (compose, CI, README, tests) debe definirla.
- Nunca valores reales de secretos en el repositorio; en compose, valores solo de desarrollo marcados como tales.
- Puertos y red: servicios locales publicados en la interfaz local, no en todas.

**Dockerfile y compose**
- Imagen base con versión fijada; build multietapa; instalación reproducible desde el lockfile sin dependencias de desarrollo.
- Usuario no-root; sin secretos en `ARG`, `ENV` ni capas; `HEALTHCHECK` que pruebe algo real y coherente con el comando de arranque; ignorar en el contexto lo que no debe entrar en la imagen.

**CI/CD**
- Acciones fijadas por SHA completo con la versión en comentario; un prefijo flotante puede no existir como referencia exacta.
- Permisos mínimos declarados por job; nada de permisos de escritura globales.
- Secretos que no se imprimen ni llegan a PRs de forks; sin checkout de código de PR con permisos elevados.
- Coherencia entre lo que corre CI y lo que corre en local (mismos umbrales y variables).
- Timeouts de job y cancelación de runs obsoletos; lo caro (mutación, carga) fuera de cada push.

**Task runner y scripts**
- El task runner es la fuente de verdad de comandos y umbrales; no se duplican sin referenciarlo.
- Recetas con modo estricto cuando encadenan comandos.

**Salida.** Fichero y línea, el riesgo concreto (qué rompe, cuándo), la versión o valor correcto con su justificación y cómo comprobarlo.
