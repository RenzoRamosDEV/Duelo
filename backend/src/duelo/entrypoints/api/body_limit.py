"""Tamaño máximo del cuerpo de las escrituras (ASGI puro).

FastAPI lee y decodifica todo el JSON antes de autenticar y antes de que el caso de uso trunque el
diff, así que sin este límite un cuerpo enorme se carga entero en memoria. Aquí se corta antes: por
`Content-Length` sin leer nada, o contando los bytes del flujo cuando no hay `Content-Length`. La
ingesta tiene su propio tope (lleva diffs); el resto de `POST`, `PUT` y `PATCH`, el general.
"""

from __future__ import annotations

import json
from collections.abc import Collection

from starlette.types import ASGIApp, Message, Receive, Scope, Send

INGEST_PATHS = frozenset({"/ingest/commit", "/ingest/pr"})
LIMITED_METHODS = frozenset({"POST", "PUT", "PATCH"})


class BodyLimitMiddleware:
    def __init__(
        self,
        app: ASGIApp,
        *,
        max_bytes: int,
        ingest_max_bytes: int,
        ingest_paths: Collection[str] = INGEST_PATHS,
    ) -> None:
        self.app = app
        self._max_bytes = max_bytes
        self._ingest_max_bytes = ingest_max_bytes
        self._ingest_paths = frozenset(ingest_paths)

    async def __call__(self, scope: Scope, receive: Receive, send: Send) -> None:
        if scope["type"] != "http" or scope["method"] not in LIMITED_METHODS:
            await self.app(scope, receive, send)
            return

        limit = self._ingest_max_bytes if scope["path"] in self._ingest_paths else self._max_bytes
        declared = _content_length(scope)
        if declared is not None and declared > limit:
            await _reject(send, limit)
            return

        received = 0
        too_large = False
        responded = False

        async def limited_receive() -> Message:
            nonlocal received, too_large
            if too_large:
                return {"type": "http.disconnect"}
            message = await receive()
            if message["type"] == "http.request":
                received += len(message.get("body", b""))
                if received > limit:
                    # No se lanza una excepción: FastAPI convertiría cualquier fallo al leer el
                    # cuerpo en un 400. Se le anuncia que el cliente se fue y se responde 413 abajo.
                    too_large = True
                    return {"type": "http.disconnect"}
            return message

        async def guarded_send(message: Message) -> None:
            nonlocal responded
            if not too_large:
                await send(message)
            elif not responded:
                responded = True
                await _reject(send, limit)
            # Con el límite superado se descarta cualquier otra respuesta de la aplicación.

        try:
            await self.app(scope, limited_receive, guarded_send)
        except Exception:
            if not too_large:
                raise
        if too_large and not responded:
            await _reject(send, limit)


async def _reject(send: Send, limit: int) -> None:
    # El mensaje solo lleva el límite aplicado, nunca nada del cuerpo recibido.
    body = json.dumps({"detail": f"El cuerpo supera el máximo de {limit} bytes."})
    payload = body.encode("utf-8")
    await send(
        {
            "type": "http.response.start",
            "status": 413,
            "headers": [
                (b"content-type", b"application/json"),
                (b"content-length", str(len(payload)).encode("ascii")),
                # Parte del cuerpo quedó sin leer: la conexión no se reutiliza.
                (b"connection", b"close"),
            ],
        }
    )
    await send({"type": "http.response.body", "body": payload})


def _content_length(scope: Scope) -> int | None:
    for name, value in scope["headers"]:
        if name == b"content-length":
            text = value.decode("latin-1").strip()
            return int(text) if text.isdigit() else None
    return None
