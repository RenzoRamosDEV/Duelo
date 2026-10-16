from __future__ import annotations

from typing import Annotated

from fastapi import APIRouter, Query, Request

from duelo.entrypoints.api.schemas import NO_NUL, AgentStatsResponse, ErrorResponse

router = APIRouter(tags=["stats"])

MAX_PROJECT = 255


@router.get(
    "/stats/agents",
    response_model=list[AgentStatsResponse],
    responses={404: {"model": ErrorResponse}},
)
async def agent_stats(
    request: Request,
    project: Annotated[str | None, Query(max_length=MAX_PROJECT, pattern=NO_NUL)] = None,
) -> list[AgentStatsResponse]:
    """Métricas por agente: globales, o solo de un proyecto (`project=owner/repo`)."""
    # `ProjectNotFound` → 404 lo resuelve el handler común.
    stats = await request.app.state.dependencies.agent_stats(project)
    return [AgentStatsResponse.from_domain(s) for s in stats]
