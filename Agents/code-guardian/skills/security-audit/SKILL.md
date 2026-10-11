---
name: security-audit
description: Seguridad del código y la configuración: secretos expuestos, inyección, salida sin escapar, validación de entrada, autenticación y autorización, criptografía, fugas en logs, cadena de suministro y superficie de prompts.
---

Un hallazgo de seguridad bloqueante exige una ruta de explotación explicada paso a paso leyendo el código. Si solo es una sospecha, es probable o va al resumen como duda: no declares una vulnerabilidad que no puedes explicar.

**Secretos.** Claves, tokens, contraseñas y cadenas de conexión en código, tests, ejemplos de documentación, ficheros de compose, workflows de CI o mensajes de commit. Un secreto que llegó a un commit se considera comprometido aunque se borre después: el arreglo incluye rotarlo.

**Inyección.** SQL construido con texto concatenado o formateado con datos externos (deben ir como parámetros); comandos de shell con entrada externa; plantillas; deserialización insegura (`pickle`, carga de YAML sin modo seguro); rutas de fichero con `..`.

**Salida.** HTML sin escapar, inserción de HTML crudo en el frontend, Markdown renderizado sin sanear cuando el contenido viene de terceros; enlaces externos sin `rel="noopener noreferrer"`.

**Entrada.** Toda entrada externa tiene tipo, longitud máxima y rechazo de lo inválido en el límite del sistema (esquema y dominio), no solo en el cliente.

**Autenticación y autorización.** ¿La ruta nueva exige credencial? ¿Se comprueba que el recurso pertenece a quien lo pide? ¿Hay rutas nuevas fuera de la dependencia de auth? ¿Los secretos se comparan en tiempo constante? ¿Los tokens se generan con aleatoriedad criptográfica?

**Criptografía.** Algoritmos propios o débiles (MD5/SHA1 para seguridad), `random` para tokens, secretos comparados con `==`.

**Fugas.** Logs, trazas y respuestas de error con tokens, SQL, rutas internas o datos personales; modo debug activo; CORS abierto con credenciales; servicios publicados en todas las interfaces cuando debían quedar en local.

**Red.** Peticiones a URLs controladas por el usuario (SSRF); puertos expuestos sin necesidad.

**Cadena de suministro.** Dependencias nuevas innecesarias, sin fijar, de mantenedores dudosos o con nombres parecidos a otras conocidas; acciones de CI sin fijar por SHA; imágenes base sin versión; contenedores como root o con secretos en capas.

**Prompts y agentes.** Si el diff toca prompts, definiciones de agentes o código que invoca modelos: los datos de terceros (diffs, mensajes, salidas de otros agentes) deben ir delimitados como datos, nunca como instrucciones; las salidas se validan contra un esquema antes de guardarse o mostrarse; los agentes de revisión no tienen herramientas de escritura ni ejecución.

**Cómo confirmarlo.** Si puedes leer el repositorio, sigue la entrada desde el borde hasta el uso y busca la validación o el escape que falte. Si solo tienes el diff, señala como `risk` lo que el diff muestra sin ambigüedad (un secreto, una concatenación en SQL) y deja el resto como duda.

**Qué reportar.** El activo en riesgo, quién puede explotarlo y cómo, el impacto y la corrección concreta (parámetros, validación, escape, rotación del secreto).
