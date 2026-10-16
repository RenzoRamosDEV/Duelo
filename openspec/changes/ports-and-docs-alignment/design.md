# Design

## Context

`ports.py`: 15 protocolos, 6 excepciones, 4 dataclasses, 336 líneas; 44 ficheros importan de
`duelo.application.ports` (el nombre más importado es `ReviewStartError`, 8 veces).
`openspec/config.yaml` fija un stack escrito antes de las fases 3 y 4 y no se actualizó al decidir
lo contrario en ADRs y changes.

## Goals / Non-Goals

**Goals:**
- Que cada puerto se encuentre por la capacidad a la que sirve.
- Que el contexto que leen los agentes al proponer un change sea verdad.

**Non-Goals:**
- Cambiar firmas, nombres o docstrings de los puertos.
- Reescribir los importadores: el paquete reexporta y el camino público no cambia.
- Escribir los ADR que faltan (CLI vs SDK, sondeo vs SSE): se señalan, no se escriben aquí.

## Decisions

**Paquete `application/ports/` con fachada.** Módulos: `changes` (`CommitWithReviews`,
`ChangeRepository`, `ChangeEventRepository`), `reviews` (`ReviewAgent`, `ArchiveOutcome`,
`ReviewArchive`, `ReviewRepository`), `projects` (`ProjectPaths`, `ProjectSlugs`,
`ProjectRepository`, `ProjectAgents`, `ProjectCatalog`, `ProjectAlreadyExists`), `git`
(`InvalidRepository`, `HookInstallError`, `RepoInfo`, `GitRepository`, `HookInstaller`,
`HistoryUnavailable`, `RepositoryHistory`, `CommitMarks`), `github` (`GithubUnavailable`,
`PullRequestInfo`, `GithubPrSource`), `orchestration` (`ReviewStartError`, `ReviewStarter`) y
`rate_limit` (`RateLimitDecision`, `RateLimiter`). `__init__.py` importa y reexporta con `__all__`
explícito. El texto de cada puerto se mueve tal cual (`git mv` + recorte), sin tocar docstrings.
Alternativa descartada: rewrite de los 44 imports a los submódulos; es churn sin ganancia mientras
el paquete sea pequeño, y se puede hacer módulo a módulo cuando se toque cada fichero.

**`config.yaml`: realidad primero, plan después.** La sección de stack se reescribe en dos
partes: lo que el repo usa hoy, con la fuente de cada decisión entre paréntesis, y lo que el spec
planea y sigue pendiente, con su fase. La arquitectura hexagonal, la regla de capas, los tres
procesos, la regla «por Temporal solo ids y extractos acotados» y el outbox se conservan porque
son verdad; se corrige el detalle (no hay trigger NOTIFY ni SSE: hay `GET /changes/{id}/events` y
sondeo). Las restricciones duras se mantienen, marcando «pendiente» la de gitleaks sobre el diff.

## Risks / Trabajo asociado

- **Cobertura al 100 % en `application`**: los `...` de los protocolos ya cuentan hoy; los
  `import` de la fachada se ejecutan al importar. Si el umbral bajase, `just test` lo diría.
- **mutmut** muta `application/`; los puertos no tienen lógica y no generan mutantes.

## Migration Plan

Sin migración. Commits: `refactor(application)` paquete de puertos, `docs(openspec)` config.yaml,
`docs` architecture.

## Open Questions

Ninguna.
