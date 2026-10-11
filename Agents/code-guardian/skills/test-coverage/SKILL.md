---
name: test-coverage
description: Calidad de las pruebas del cambio: qué lógica nueva queda sin test, tests que no detectarían un fallo, casos límite y negativos, regresión para cada fix, fragilidad.
---

Mide si los tests **detectarían un fallo**, no cuántos hay. Un repositorio puede tener cobertura altísima y asserts que no protegen nada.

**Qué se esperaba y qué hay.** Para cada pieza de lógica nueva o modificada: ¿qué comportamiento tiene que cumplir y qué test lo fija? Si puedes leer el repositorio, busca el test por el nombre de la función o del módulo; si solo tienes el diff, mira si el diff trae tests para lo que cambia. Anota lo que no tiene test.

**Qué hace buena una prueba**
- Falla por la razón correcta: si rompieras el código de producción, ¿fallaría? Un test que repite la implementación o solo comprueba que «no lanza» no protege nada.
- Asserts sobre el resultado observable (valor devuelto, fila persistida, evento emitido), no sobre llamadas internas. Cuando algo se persiste, se comprueba la fila real.
- Un comportamiento por test, con nombre que lo describe.
- Sin dependencias ocultas: orden, hora, red, aleatoriedad sin semilla, sleeps fijos. Se esperan condiciones con tiempo máximo, no se duerme a ciegas.
- Fakes fieles: un fake que deduplica o falla como el real; si divergen, el verde engaña.

**Técnicas, cuando aportan**
- Valores límite en cualquier límite numérico o de longitud: `límite-1`, `límite`, `límite+1`.
- Clases de equivalencia cuando hay tramos con comportamientos distintos.
- Tabla de decisión cuando varias condiciones combinadas deciden el resultado.
- Transiciones de estado válidas e inválidas si hay máquina de estados.
- Regresión para todo `fix`: un test que reproduzca el fallo original.
- Negativos: entrada inválida, dependencia caída, dato ausente, permiso denegado.

No pidas una técnica que no aporta: un test redundante o de relleno es un hallazgo menor (candidato a borrar o fusionar), no una virtud.

**Fragilidad.** Sleeps fijos, igualdad exacta sobre conteos de eventos asíncronos, puertos fijos, dependencia del orden entre tests o de datos de otro test.

**Ubicación.** Un test de integración donde bastaba uno unitario, o un unitario que necesita infraestructura, está mal ubicado; respeta la organización que el repositorio ya tiene.

**Salida.** Comportamientos sin test (con el test que propones), tests débiles o frágiles (con el escenario que los vence). Un test ausente para una rama de negocio nueva cuenta como defecto importante en la rúbrica.
