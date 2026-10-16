"""Mapeo único a HTTP de las excepciones de aplicación que comparten varios routers.

Cada router sigue declarando sus `responses` (el contrato OpenAPI no cambia); lo que no repite es
el `except` que convierte la excepción en código y mensaje.
"""

from __future__ import annotations

from fastapi import FastAPI, Request, status
from fastapi.responses import JSONResponse

from duelo.application.ingest_commit import ProjectNotFound
from duelo.application.ports import ReviewStartError

REVIEW_START_FAILED = "No se pudo arrancar la review, reintenta"


async def _project_not_found(_request: Request, exc: Exception) -> JSONResponse:
    # El mensaje de `ProjectNotFound` ya es «Proyecto desconocido: {slug}», sin datos internos.
    return JSONResponse({"detail": str(exc)}, status_code=status.HTTP_404_NOT_FOUND)


async def _review_start_failed(_request: Request, _exc: Exception) -> JSONResponse:
    # El change ya quedó guardado (o `run` no avanzó): reenviar la misma petición es seguro. El
    # texto de la excepción no sale: puede llevar la dirección de Temporal.
    return JSONResponse(
        {"detail": REVIEW_START_FAILED}, status_code=status.HTTP_503_SERVICE_UNAVAILABLE
    )


def register_error_handlers(app: FastAPI) -> None:
    app.add_exception_handler(ProjectNotFound, _project_not_found)
    app.add_exception_handler(ReviewStartError, _review_start_failed)
