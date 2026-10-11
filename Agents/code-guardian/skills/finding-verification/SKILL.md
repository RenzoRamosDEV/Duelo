---
name: finding-verification
description: Protocolo anti-invención: cada hallazgo exige ubicación, traza del dato, intento de refutación y nivel de confianza antes de entrar en la review. Lo que no lo supera se degrada o va al resumen como duda.
---

Un hallazgo sin evidencia es ruido. Antes de incluir uno, pásalo por estos pasos. Si no los supera, no se descarta en silencio: se degrada o se mueve al resumen como duda.

**Los pasos**
1. **Localiza.** Fichero y línea en el diff. Si puedes leer el repositorio, lee también el contexto (unas 30 líneas alrededor) y los llamadores.
2. **Traza.** Sigue el dato desde donde entra hasta donde falla: ¿quién llama?, ¿qué valores puede recibir de verdad?, ¿hay validación aguas arriba, un `try`, una constraint de base de datos o un tipo que lo impide? Un «posible nulo» que ningún camino produce no es un bug.
3. **Intenta refutarlo.** Busca activamente la razón por la que el hallazgo sea falso: un test que lo cubre, una herramienta del repositorio que ya lo atrapa, un comentario o documento que explique la decisión.
4. **Asigna confianza** y redacta la evidencia en el mensaje del hallazgo («cómo lo has comprobado»).

**Niveles de confianza**
- Confirmado: demostrado leyendo el código, sin ningún camino que lo evite. Puede llevar la nota a 0–3.
- Probable: consistente con el código leído, con un camino plausible, pero no demostrado. Como mucho lleva la nota a 4–6.
- Hipótesis: depende de algo que no has podido ver (configuración de producción, otro repositorio, datos reales). No es un hallazgo: va al resumen como duda, si merece la pena.

Regla dura: **solo un hallazgo confirmado puede ser bloqueante.** La gravedad es el impacto; la confianza, la evidencia. Son ejes distintos: no subas la confianza porque «suena grave».

**Señales de falso positivo**
- El código «raro» lo exige una decisión escrita del proyecto.
- El patrón se repite en todo el repositorio y está cubierto por tests.
- Una herramienta estática del repositorio ya lo comprueba y pasa.
- Sospechas una condición de carrera pero hay una constraint única con `ON CONFLICT` o un identificador determinista que ya la resuelve.
- Lo que parece código muerto lo referencia un registro dinámico por nombre.

**Nunca**
- Reportar un bug por «olor» sin ruta de ejecución.
- Afirmar que algo falla sin haberlo leído.
- Decir que comprobaste algo que no comprobaste. Si solo tienes el diff, dilo en el mensaje: «visto solo en el diff».
