## MODIFIED Requirements

### Requirement: Prompt versionado y común
Las instrucciones de revisión SHALL vivir en una carpeta de agente `Agents/<agente>/` con un
fichero de agente y sus skills dentro (`skills/<nombre>/`), versionadas por git, y SHALL ser las
mismas para todos los agentes de una misma ejecución. El fichero de agente SHALL declarar un
número de versión del criterio; todo cambio de criterio (agente o skills) SHALL incrementarlo. El
sistema SHALL fallar con un error claro que nombre la ruta si falta el agente, una skill
declarada o la marca de datos no confiables.

#### Scenario: Mismo prompt para los dos agentes
- **WHEN** Claude y Codex revisan el mismo change
- **THEN** ambos reciben el mismo prompt compuesto desde `Agents/code-guardian/`, más los mismos
  datos delimitados del change

#### Scenario: Fichero ausente
- **WHEN** la carpeta del agente activo no tiene fichero de agente en disco
- **THEN** construir el prompt falla con un error que nombra la ruta esperada

#### Scenario: Skill declarada que no existe
- **WHEN** el agente declara como siempre activa una skill sin fichero en `skills/`
- **THEN** construir el prompt falla con un error que nombra la ruta esperada de esa skill

#### Scenario: Versión del criterio
- **WHEN** se consulta la versión del prompt activo
- **THEN** coincide con el número declarado en el fichero de agente

## ADDED Requirements

### Requirement: Composición del prompt
El prompt SHALL componerse en este orden: cuerpo del agente, skills siempre activas en el orden
en que el agente las declara, skills activadas por el diff en orden alfabético y, por último, los
datos del change. Cada skill SHALL ir bajo un encabezado con su nombre. La composición SHALL ser
determinista: el mismo agente y el mismo diff producen el mismo texto salvo la marca aleatoria.

#### Scenario: Orden estable
- **WHEN** se compone dos veces el prompt del mismo change con la misma marca
- **THEN** los dos textos son idénticos y el cuerpo del agente precede a todas las skills

#### Scenario: Skill con encabezado
- **WHEN** una skill entra en el prompt
- **THEN** su texto aparece bajo un encabezado que lleva el nombre de la skill

### Requirement: Selección de skills por el diff
Una skill SHALL declarar opcionalmente patrones de ruta; sin patrones solo entra si el agente la
declara siempre activa. Una skill con patrones SHALL entrar cuando alguna ruta de los ficheros
tocados por el diff case con alguno de ellos, y NO SHALL entrar en otro caso. Las rutas SHALL
salir de las cabeceras del diff en formato `git diff`; un diff sin cabeceras SHALL activar solo
las skills siempre activas.

#### Scenario: Diff de frontend
- **WHEN** el diff toca `frontend/src/App.tsx` y ningún otro fichero
- **THEN** el prompt incluye `frontend-review` y no incluye `temporal-review`

#### Scenario: Diff de workflows
- **WHEN** el diff toca `backend/src/duelo/workflows/review_change.py`
- **THEN** el prompt incluye `temporal-review`

#### Scenario: Diff sin cabeceras
- **WHEN** el diff está vacío o no tiene cabeceras `diff --git`
- **THEN** el prompt incluye exactamente las skills siempre activas

### Requirement: Skills especializadas del revisor
El agente de revisión SHALL llevar siempre activas las skills de detección de errores,
seguridad, regresiones, cobertura de tests, higiene del cambio, verificación de hallazgos e
informe (rúbrica y severidades). SHALL disponer, activadas por el diff, de skills de
arquitectura, contratos de API y datos, dependencias y configuración, frontend, rendimiento y
Temporal. Ninguna skill SHALL pedir al agente ejecutar comandos, modificar ficheros ni cargar
otras skills.

#### Scenario: Revisor de solo lectura
- **WHEN** se compone el prompt con todas las skills
- **THEN** el texto no contiene instrucciones de ejecutar comandos de build o test ni de
  modificar el repositorio

#### Scenario: Diff de migraciones
- **WHEN** el diff toca un fichero bajo `alembic/versions/`
- **THEN** el prompt incluye la skill de contratos de API y datos
