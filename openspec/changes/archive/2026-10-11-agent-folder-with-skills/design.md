# Design

## Context

- Hoy `adapters/agents/review_payload.py` lee `prompts/review/v2.md` (`load_instructions`,
  cacheada) y `build_prompt` lo concatena con el bloque de datos del change. Los dos CLI reciben
  ese texto por la entrada estándar; Claude con `--setting-sources ""`, `--disable-slash-commands`
  y herramientas `Read,Grep,Glob` sobre la carpeta del proyecto revisado (que puede no ser Duelo);
  Codex sin shell, en un directorio vacío. Ninguno puede cargar skills por su cuenta: **el
  producto tiene que inlinear en el prompt todo lo que quiera que lean**.
- `domain/diff.py` ya extrae las rutas de las cabeceras `diff --git` (`summarize_diff`).
- Las skills originales (`git show 67a57ef^:.claude/skills/<nombre>/SKILL.md`) suman ~55 KB y
  están escritas para un agente de Claude Code con `Bash`, hook de solo lectura, herramienta
  `Skill` y conocimiento de este repo (`just test-unit`, rutas de Duelo).
- El `agents` worker corre desde el checkout del repo (fuera de Docker), así que `Agents/` se lee
  del disco como ya se leía `prompts/`. El `Dockerfile` no copia ni una ni otra.
- `pyyaml` no es dependencia de runtime (solo transitiva de herramientas de desarrollo).

## Goals / Non-Goals

**Goals:**
- Un agente = una carpeta: `Agents/code-guardian/AGENT.md` + `skills/<nombre>/SKILL.md`.
- Composición determinista del prompt en el backend, con triaje por rutas del diff para no
  mandar 55 KB de instrucciones a cada review.
- Contenido de las skills recuperado y adaptado a un revisor de solo lectura.

**Non-Goals:**
- Que los CLI carguen skills dinámicamente (no pueden en el modo en que los lanzamos).
- Varios agentes a la vez o un agente por proveedor: hay un solo agente activo, el mismo para
  Claude y Codex (el duelo exige el mismo criterio).
- Guardar `prompt_version` en la tabla `reviews` (sigue pendiente).
- Un formato de skills compatible con Claude Code (`allowed-tools`, `context: fork`…): el
  frontmatter que se lee es el nuestro.

## Decisions

1. **Carpeta `Agents/` en la raíz, agente `code-guardian`.** Ruta resuelta como hoy
   (`Path(__file__).resolve().parents[5] / "Agents"`), constante `AGENT_NAME = "code-guardian"`.
   Alternativa descartada: `backend/src/duelo/agents/` como recurso del paquete; el usuario quiere
   la carpeta a la vista en la raíz y la spec de producto habla de «prompts como código» fuera
   del backend.
2. **Módulo nuevo `adapters/agents/agent_folder.py`** con `Skill(name, description, paths, body)`,
   `AgentDefinition(name, version, body, always: tuple[str], skills: dict[str, Skill])`,
   `load_agent(root) -> AgentDefinition` (cacheada por ruta) y `select_skills(agent, files) ->
   tuple[Skill, ...]`. `review_payload.py` conserva `build_prompt(change, nonce, instructions)`:
   sin `instructions` inyectadas compone agente + skills + datos; `PROMPT_VERSION` deja de ser
   una constante y pasa a `prompt_version() -> str` (`"v3"`, derivado del frontmatter) para que
   quien lo registre en logs tenga el mismo formato que hasta ahora.
3. **Frontmatter mínimo sin dependencia nueva.** Bloque `---` … `---` con `clave: valor` y listas
   `- item`; solo se leen `name`, `version` (entero), `skills` (agente) y `name`, `description`,
   `paths` (skill). Cualquier otra clave se ignora. Alternativa: añadir `pyyaml` al runtime por
   cuatro claves; descartada.
4. **Selección por globs `fnmatch` sobre la ruta completa del fichero**, donde `*` también cruza
   directorios (`*workflows/*`, `*.tsx`, `*alembic/versions/*`, `Dockerfile`,
   `*pnpm-lock.yaml`). Rutas de `summarize_diff(change.diff).files` (hasta 200; un diff mayor ya
   está recortado y no revisa más ficheros). Alternativa: `PurePath.match`, que en 3.12 no entiende
   `**`; descartada. Las skills siempre activas van en el `skills:` del agente y no necesitan
   `paths`; una skill con `paths` y además listada en `skills:` entra siempre (sin duplicar).
5. **Orden del prompt**: cuerpo del agente → skills siempre activas en el orden declarado →
   skills por diff en orden alfabético → datos del change. Cada skill bajo
   `## Skill: <name>` con su `description` como primera línea. El `{mark}` vive solo en
   `AGENT.md` (se valida al cargar); las skills no llevan marcas.
6. **Contenido.** `AGENT.md` reúne lo que hoy tiene `v2.md` menos lo que pasa a skills:
   principios (errores reales antes que estética, contexto antes de juzgar, no modificar nada,
   no inventar), prioridades, flujo (leer intención → analizar con las skills → verificar →
   informar), el bloque de datos no confiables con `{mark}` y el formato JSON. Las skills se
   recuperan de git y se recortan: fuera comandos, hooks, `Skill`, tablas de triaje, rutas de
   Duelo; dentro listas de qué buscar, cómo confirmar con lectura del repo (si el agente tiene
   herramientas) o solo con el diff, y qué es bloqueante/importante. `change-hygiene` pierde su
   `references/history.md` (anécdotas de este repo). `review-report` queda como rúbrica
   0–3 / 4–6 / 7–10 y severidades, sin la plantilla de informe en texto (la salida es JSON).
   Objetivo de tamaño: agente + siempre activas ≤ 30 KB; con todas las skills ≤ 60 KB (el diff
   ya ocupa hasta 60 KB). Un test fija esas cotas.
7. **Versión 3 en `AGENT.md`**; `prompts/review/v2.md` se borra (git lo conserva). Regla nueva en
   la spec: todo cambio de criterio sube `version`. Alternativa: mantener `v2.md` como
   «versión congelada»; descartada porque nadie la lee y divergiría.
8. **Errores de carga**: `FileNotFoundError` con la ruta para agente o skill ausente;
   `ValueError` con la ruta si falta `{mark}` o `version` no es entero. Se producen al construir
   el primer prompt (carga perezosa), igual que hoy.

## Risks / Trade-offs

- [Prompt más largo → reviews más lentas y caras] → triaje por rutas; cotas de tamaño en test;
  `MAX_DIFF_IN_PROMPT` no cambia. Medir en la review real de cierre (hoy: Codex 14 s, Claude
  104 s con v2 sobre un diff de 100 KB).
- [Un glob mal escrito deja una skill muerta] → test por skill con un diff de ejemplo que la
  activa, y test de que ninguna skill de `skills/` queda sin declarar en `AGENT.md` ni sin
  `paths` (sería inaccesible).
- [Instrucciones de las skills que solo un agente con lectura puede cumplir] → cada skill
  distingue «si puedes leer el repo» / «si solo tienes el diff», como ya hace `v2.md`.
- [El cambio de rúbrica/criterio entre v2 y v3 altera las notas] → el criterio es el mismo
  (v2 ya era la versión plana de estas skills); solo gana profundidad. Se comprueba con una
  review real antes de cerrar.
- [Frontmatter casero] → subconjunto cerrado y documentado en el módulo; un fichero con sintaxis
  fuera del subconjunto falla con la ruta.

## Migration Plan

1. Crear `Agents/code-guardian/` y el módulo de carga; `build_prompt` pasa a usarlo.
2. Borrar `prompts/review/`; actualizar docs y spec.
3. Reiniciar el worker `agents` (`just worker`): no hay cambio de contrato ni de Temporal, las
   reviews en vuelo terminan con el prompt que ya tenían en memoria.
   Rollback: `git revert` del commit; el worker vuelve a leer `prompts/review/v2.md`.
