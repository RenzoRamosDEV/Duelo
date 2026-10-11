# Proposal

## Why

El criterio de revisión del producto vive hoy en un único fichero plano, `prompts/review/v2.md`,
que resume en siete kilobytes lo que antes eran un agente (`code-guardian`) y catorce skills
especializadas. Al aplanarlo se perdió la profundidad por familia (seguridad, contratos de API y
datos, dependencias y configuración, frontend, Temporal, rendimiento, refactors) y la estructura
que hacía el criterio legible y mantenible por partes. El usuario quiere que el agente y sus
skills vuelvan a existir como tales, **dentro del producto**, en una carpeta `Agents/` donde cada
agente contiene sus propias skills, y que el backend componga el prompt a partir de ellas.

## What Changes

- **Nueva carpeta `Agents/code-guardian/`** en la raíz del repositorio, con:
  - `AGENT.md`: frontmatter (`name`, `version`, `skills` siempre activas) y cuerpo con los
    principios, el flujo de revisión, el bloque de datos no confiables (`{mark}`) y el formato
    JSON de salida. Sustituye a `prompts/review/v2.md`; la versión del criterio pasa a ser `3`.
  - `skills/<nombre>/SKILL.md`, una por skill, con frontmatter (`name`, `description` y,
    opcionalmente, `paths`: globs del diff que la activan). Contenido recuperado de las skills
    borradas en `67a57ef` y adaptado a un revisor **de solo lectura, sin Bash ni carga dinámica**:
    se conservan qué buscar, cómo verificar y qué cuenta como bloqueante; desaparecen los
    comandos `just`/`uv`, el hook, la herramienta `Skill` y las referencias a este repo.
  - Siempre activas: `bug-detection`, `security-audit`, `safe-refactoring` (regresiones),
    `test-coverage`, `change-hygiene`, `finding-verification`, `review-report` (rúbrica y
    severidades). Activadas por las rutas del diff: `architecture-review`,
    `data-and-api-contracts`, `dependency-and-config-audit`, `frontend-review`,
    `performance-review`, `temporal-review`. `diff-review` (triaje) y `guardian` (comando de
    Claude Code) no vuelven: el triaje lo hace el backend y el comando no es del producto.
- **El backend compone el prompt**: `AGENT.md` + skills siempre activas + skills cuyos `paths`
  casan con algún fichero del diff (orden determinista) + datos del change. El mismo prompt para
  Claude y Codex. Un agente sin `AGENT.md`, una skill declarada que no existe o un `AGENT.md` sin
  `{mark}` hacen fallar la carga con un error que nombra la ruta.
- **Versionado del criterio**: `version` en el frontmatter de `AGENT.md` sustituye al
  `v{n}.md`. Cambiar el criterio (agente o skills) exige subir `version`; git conserva las
  anteriores. **BREAKING** respecto al requisito «una versión ya usada no se edita, un cambio es
  un fichero nuevo»: con una carpeta por agente se edita en sitio y se sube el número.
- `prompts/review/` desaparece (su contenido queda en git y reorganizado en `Agents/`).
- Docs: `CONTRIBUTING.md`, `docs/architecture.md`, `docs/spec/duelo.md`, `openspec/config.yaml`
  (layout) y `docs/temporal-buenas-practicas.md` (la skill `temporal-review` vuelve a existir,
  ahora en el producto) apuntan a `Agents/`.
- El contrato JSON de la review no cambia: ni base de datos, ni API, ni frontend.

## Capabilities

### New Capabilities

### Modified Capabilities
- `review-criteria`: el prompt deja de ser un fichero `v{n}.md` y pasa a ser un agente con
  skills en `Agents/<agente>/`, compuesto por el producto, con selección de skills por las rutas
  del diff y versión en el frontmatter del agente.

## Impact

- Código: `backend/src/duelo/adapters/agents/review_payload.py` (carga y composición del
  agente; `PROMPT_VERSION` sale del frontmatter) y un módulo nuevo para leer `Agents/`
  (frontmatter mínimo, selección de skills). Reutiliza `domain/diff.py` para las rutas del diff.
- Nuevo: `Agents/code-guardian/AGENT.md` y 13 `SKILL.md`.
- Borrado: `prompts/review/v2.md`.
- Tests: unitarios de carga (frontmatter, skills ausentes, `{mark}`), de selección por rutas y de
  composición determinista; los de `build_prompt` existentes se adaptan a la nueva fuente.
- Docs: los cinco ficheros citados arriba. El change anterior (`review-prompt-guardian-criteria`)
  queda archivado tal cual; su spec se modifica con este delta.
- Sin cambios en API, base de datos ni frontend. `prompt_version` en la tabla `reviews` sigue
  pendiente.
