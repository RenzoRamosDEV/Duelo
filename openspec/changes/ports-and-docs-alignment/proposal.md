# Proposal

## Por qué

`application/ports.py` reúne en 336 líneas quince protocolos, seis excepciones y cuatro DTOs
ordenados por tipo de cosa, no por capacidad: para saber qué necesita el barrido de alcanzabilidad
o la alta de proyectos hay que leerlo entero. Y `openspec/config.yaml`, que cada change de OpenSpec
lee como contexto «vinculante», describe un stack que no es el del repo: Tailwind + shadcn,
TanStack, SSE con `sse-starlette`, Claude Agent SDK, Langfuse, `scripts/install-hook.sh`. Cada
propuesta nueva arranca con un contexto falso. Es la fase 5 y última del plan de refactor.

## Qué cambia

- **Puertos por capacidad.** `application/ports.py` pasa a ser el paquete `application/ports/`
  con un módulo por capacidad (`changes`, `reviews`, `projects`, `git`, `github`, `orchestration`,
  `rate_limit`) y un `__init__.py` que reexporta todos los nombres: los 44 ficheros que importan
  de `duelo.application.ports` no cambian.
- **`openspec/config.yaml` alineado con la realidad**, citando dónde se decidió cada cosa: la
  estética y el CSS plano con tokens (ADR 0003 y 0004), los CLI con la sesión del usuario en vez
  del Agent SDK (README y change `add-cli-agents`), el sondeo cada 5 s con el SSE todavía en el
  plan (README), los tipos generados con `openapi-typescript` (change `typed-api-contract`), el
  versionado de workflows (ADR 0007) y lo que sigue pendiente (gitleaks sobre el diff, Langfuse,
  promptfoo, voto ciego), marcado como tal.
- **Docs**: `docs/architecture.md` nombra el paquete de puertos en vez del fichero.

Sin cambio de comportamiento ni de API: solo organización y documentación.

## Capacidades

### Nuevas capacidades

(ninguna: reorganización y documentación; `skip_specs: true`)

### Capacidades modificadas

(ninguna)

## Impacto

- `backend/src/duelo/application/ports/` (nuevo paquete, borra `ports.py`), `openspec/config.yaml`,
  `docs/architecture.md`.
- Sin dependencias nuevas. `import-linter` sigue viendo `duelo.application` como una capa.
- Dos decisiones del repo no tienen ADR propio (CLI en vez de Agent SDK; sondeo en vez de SSE): se
  citan sus fuentes, y escribir esos ADR queda señalado como posible seguimiento, fuera de este
  change.
- Done-when: `just ci` en verde, `grep "application.ports"` sin cambios en los importadores, y
  `config.yaml` sin ninguna tecnología que el repo no use sin marcarla como pendiente.
