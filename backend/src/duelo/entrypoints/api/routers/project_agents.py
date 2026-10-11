from __future__ import annotations

from fastapi import APIRouter, Depends, HTTPException, Request, status
from fastapi.exceptions import RequestValidationError

from duelo.application.ingest_commit import ProjectNotFound
from duelo.application.project_agents import InvalidAgentSelection
from duelo.entrypoints.api.auth import require_ingest_token
from duelo.entrypoints.api.rate_limit import rate_limit
from duelo.entrypoints.api.schemas import AgentsRequest, ErrorResponse, ProjectResponse

# A diferencia de alta y baja de proyectos, no toca el disco: no depende de LOCAL_PROJECTS_ENABLED.
router = APIRouter(
    tags=["projects"],
    dependencies=[Depends(rate_limit("project-agents")), Depends(require_ingest_token)],
)


@router.put(
    # `path`: los slugs tienen forma `owner/repo` y contienen una barra.
    "/projects/{slug:path}/agents",
    response_model=ProjectResponse,
    responses={
        400: {"model": ErrorResponse},
        401: {"model": ErrorResponse},
        404: {"model": ErrorResponse},
        429: {"model": ErrorResponse},
    },
)
async def set_agents(slug: str, body: AgentsRequest, request: Request) -> ProjectResponse:
    try:
        project = await request.app.state.dependencies.set_project_agents(slug, body.agents)
    except ProjectNotFound as exc:
        raise HTTPException(status.HTTP_404_NOT_FOUND, f"Proyecto desconocido: {exc.slug}") from exc
    except InvalidAgentSelection as exc:
        # Mismo formato que cualquier otro 422 de validación del cuerpo.
        raise RequestValidationError(
            [
                {
                    "type": "value_error",
                    "loc": ("body", "agents"),
                    "msg": str(exc),
                    "input": body.agents,
                }
            ]
        ) from exc
    return ProjectResponse.from_domain(project)
