"""Tamaño máximo del cuerpo de la ingesta: 413 antes de leerlo o al contar el flujo."""

from __future__ import annotations

import json
import logging
import socket
import threading
import time
from collections.abc import AsyncIterator, Iterator
from uuid import uuid4

import httpx
import pytest
import uvicorn

from duelo.entrypoints.api.body_limit import BodyLimitMiddleware
from duelo.entrypoints.api.middleware import access_logger
from tests.fakes.api import TOKEN, FakeApi, build_fake_api, valid_body

HEADERS = {"X-Ingest-Token": TOKEN}
SECRET = "SECRETO-DEL-CUERPO"


def _client(api: FakeApi) -> httpx.AsyncClient:
    return httpx.AsyncClient(
        transport=httpx.ASGITransport(app=api.app, raise_app_exceptions=False),
        base_url="http://test",
    )


def _size(body: dict[str, object]) -> int:
    return len(json.dumps(body).encode("utf-8"))


async def _chunks(total: int, *, size: int = 1000) -> AsyncIterator[bytes]:
    sent = 0
    while sent < total:
        piece = min(size, total - sent)
        yield b"x" * piece
        sent += piece


def _no_effects(api: FakeApi) -> None:
    assert api.changes.persisted_events == []
    assert api.starter.calls == 0


@pytest.mark.parametrize("path", ["/ingest/commit", "/ingest/pr"])
async def test_a_declared_length_over_the_limit_is_413_without_effects(path: str) -> None:
    api = build_fake_api(max_ingest_body_bytes=1000)

    async with _client(api) as client:
        response = await client.post(
            path, json=valid_body(title="t", diff=f"{SECRET}" + "x" * 5000), headers=HEADERS
        )

    assert response.status_code == 413
    assert "1000" in response.json()["detail"]
    assert SECRET not in response.text  # el cuerpo recibido nunca se devuelve
    _no_effects(api)


async def test_the_limit_is_inclusive_one_byte_more_is_rejected() -> None:
    body = valid_body()
    size = _size(body)
    raw = {**HEADERS, "Content-Type": "application/json"}

    async with _client(build_fake_api(max_ingest_body_bytes=size)) as client:
        exact = await client.post("/ingest/commit", content=json.dumps(body), headers=raw)
    rejected_api = build_fake_api(max_ingest_body_bytes=size - 1)
    async with _client(rejected_api) as client:
        over = await client.post("/ingest/commit", content=json.dumps(body), headers=raw)

    assert exact.status_code == 202
    assert over.status_code == 413
    _no_effects(rejected_api)


async def test_a_stream_without_content_length_is_cut_when_it_exceeds_the_limit() -> None:
    api = build_fake_api(max_ingest_body_bytes=5000)

    async with _client(api) as client:
        response = await client.post(
            "/ingest/commit",
            content=_chunks(20_000),
            headers={**HEADERS, "Content-Type": "application/json"},
        )

    assert response.status_code == 413
    _no_effects(api)


async def test_a_stream_under_the_limit_without_content_length_is_accepted() -> None:
    api = build_fake_api(max_ingest_body_bytes=10_000)
    payload = json.dumps(valid_body()).encode("utf-8")

    async def parts() -> AsyncIterator[bytes]:
        for i in range(0, len(payload), 20):
            yield payload[i : i + 20]

    async with _client(api) as client:
        response = await client.post(
            "/ingest/commit",
            content=parts(),
            headers={**HEADERS, "Content-Type": "application/json"},
        )

    assert response.status_code == 202


async def test_a_long_diff_inside_the_body_limit_is_still_truncated_not_rejected() -> None:
    """El límite HTTP protege la memoria; el truncado del diff sigue siendo el de negocio."""
    api = build_fake_api(max_diff_chars=100, max_ingest_body_bytes=10_000)

    async with _client(api) as client:
        response = await client.post(
            "/ingest/commit", json=valid_body(diff="d" * 5000), headers=HEADERS
        )

    assert response.status_code == 202
    assert response.json()["diff_truncated"] is True


async def test_the_body_limit_answers_before_the_token_and_carries_the_request_id() -> None:
    api = build_fake_api(max_ingest_body_bytes=500)

    async with _client(api) as client:
        response = await client.post("/ingest/commit", json=valid_body(diff="x" * 3000))

    assert response.status_code == 413  # sin token: ni siquiera se lee el cuerpo
    assert response.headers["X-Request-ID"]
    assert response.headers["Connection"] == "close"


async def test_other_routes_use_the_general_limit_not_the_ingest_one() -> None:
    """«Otras rutas»: por encima de `MAX_BODY_BYTES` y por debajo del de la ingesta da 413, con el
    límite general en el mensaje."""
    api = build_fake_api(max_body_bytes=100, max_ingest_body_bytes=10_000)

    async with _client(api) as client:
        response = await client.post(f"/changes/{uuid4()}/retry", content=b"x" * 5000)

    assert response.status_code == 413  # sin token daría 401: el límite responde antes
    assert "100 bytes" in response.json()["detail"]


async def test_a_huge_declared_post_to_projects_never_reaches_the_route() -> None:
    api = build_fake_api(local_projects=True)

    async with _client(api) as client:
        response = await client.post(
            "/projects",
            content=b"x" * 70_000,
            headers={**HEADERS, "Content-Type": "application/json"},
        )

    assert response.status_code == 413
    assert "65536" in response.json()["detail"]
    assert api.git.inspected == []


def _agents_body(size: int) -> bytes:
    """`{"agents": ["claude"]}` con espacios hasta ocupar exactamente `size` bytes."""
    body = b'{"agents": ["claude"]}'
    return body[:-1] + b" " * (size - len(body)) + b"}"


@pytest.mark.parametrize(("size", "status"), [(65_535, 200), (65_536, 200), (65_537, 413)])
async def test_a_put_up_to_the_general_limit_passes_and_one_byte_more_does_not(
    size: int, status: int
) -> None:
    api = build_fake_api(agent_names=["claude", "codex"])
    headers = {**HEADERS, "Content-Type": "application/json"}

    async with _client(api) as client:
        response = await client.put(
            f"/projects/{api.project.slug}/agents", content=_agents_body(size), headers=headers
        )
        listed = (await client.get("/projects")).json()[0]["agents"]

    assert response.status_code == status
    assert listed == (["claude"] if status == 200 else ["claude", "codex"])


async def test_a_chunked_put_over_the_general_limit_is_413() -> None:
    api = build_fake_api(agent_names=["claude", "codex"])

    async with _client(api) as client:
        response = await client.put(
            f"/projects/{api.project.slug}/agents",
            content=_chunks(70_000),
            headers={**HEADERS, "Content-Type": "application/json"},
        )
        listed = (await client.get("/projects")).json()[0]["agents"]

    assert response.status_code == 413
    assert listed == ["claude", "codex"]  # la selección no cambia


async def test_the_ingest_is_not_bound_by_the_general_limit() -> None:
    """«La ingesta no usa el límite general»: 100 000 bytes > 65 536 pero < 1 500 000."""
    api = build_fake_api()
    body = valid_body(diff="d" * 100_000)
    assert _size(body) > 65_536

    async with _client(api) as client:
        response = await client.post("/ingest/commit", json=body, headers=HEADERS)

    assert response.status_code == 202


async def test_the_ingest_keeps_its_own_limit_even_when_it_is_the_smaller_one() -> None:
    api = build_fake_api(max_body_bytes=10_000, max_ingest_body_bytes=500)

    async with _client(api) as client:
        response = await client.post(
            "/ingest/pr", json=valid_body(diff="x" * 3000), headers=HEADERS
        )

    assert response.status_code == 413
    assert "500 bytes" in response.json()["detail"]
    _no_effects(api)


@pytest.mark.parametrize("method", ["GET", "DELETE", "OPTIONS"])
async def test_reads_deletes_and_options_are_never_limited(method: str) -> None:
    api = build_fake_api(max_body_bytes=10, local_projects=True)

    async with _client(api) as client:
        response = await client.request(
            method, f"/projects/{api.project.slug}", content=b"x" * 5000, headers=HEADERS
        )

    assert response.status_code != 413


async def test_the_rejected_body_is_not_written_to_the_access_log(
    caplog: pytest.LogCaptureFixture, monkeypatch: pytest.MonkeyPatch
) -> None:
    # Otros tests configuran el logger real (sin propagación); aquí se captura siempre.
    monkeypatch.setattr(access_logger, "disabled", False)
    monkeypatch.setattr(access_logger, "propagate", True)
    caplog.set_level(logging.INFO, logger=access_logger.name)
    api = build_fake_api(max_ingest_body_bytes=500)

    async with _client(api) as client:
        await client.post("/ingest/commit", json=valid_body(diff=SECRET * 200), headers=HEADERS)

    assert any('"status": 413' in record.getMessage() for record in caplog.records)
    assert SECRET not in caplog.text


@pytest.fixture
def live_api() -> Iterator[tuple[FakeApi, str]]:
    """La app sobre un uvicorn real: ahí un cliente puede seguir subiendo mientras el servidor
    ya respondió 413, algo que el transporte ASGI en memoria no reproduce."""
    api = build_fake_api(max_ingest_body_bytes=1_500_000)
    with socket.socket() as probe:
        probe.bind(("127.0.0.1", 0))
        port = probe.getsockname()[1]
    server = uvicorn.Server(
        uvicorn.Config(api.app, host="127.0.0.1", port=port, log_level="warning")
    )
    thread = threading.Thread(target=server.run, daemon=True)
    thread.start()
    deadline = time.monotonic() + 10
    while not server.started and time.monotonic() < deadline:
        time.sleep(0.02)
    assert server.started, "uvicorn no arrancó"
    yield api, f"http://127.0.0.1:{port}"
    server.should_exit = True
    thread.join(timeout=10)


@pytest.mark.parametrize("framing", ["content-length", "chunked"])
def test_a_real_server_answers_413_to_a_huge_upload_and_keeps_serving(
    live_api: tuple[FakeApi, str], framing: str
) -> None:
    api, base = live_api
    big = json.dumps(valid_body(diff="d" * 6_000_000)).encode("utf-8")
    content: bytes | Iterator[bytes] = (
        big
        if framing == "content-length"
        else iter(big[i : i + 65536] for i in range(0, len(big), 65536))
    )
    headers = {**HEADERS, "Content-Type": "application/json"}

    huge = httpx.post(f"{base}/ingest/commit", content=content, headers=headers, timeout=20)
    after = httpx.post(f"{base}/ingest/commit", json=valid_body(), headers=HEADERS, timeout=20)

    assert huge.status_code == 413
    assert after.status_code == 202  # el servidor sigue atendiendo con normalidad
    assert len(api.changes.persisted_events) == 1  # solo el normal


# --- el middleware solo, con una app espía ----------------------------------------------------


class _Spy:
    def __init__(self) -> None:
        self.called = False
        self.read = 0

    async def __call__(self, scope, receive, send) -> None:  # type: ignore[no-untyped-def]
        self.called = True
        while True:
            message = await receive()
            if message["type"] != "http.request":
                break
            self.read += len(message.get("body", b""))
            if not message.get("more_body"):
                break
        await send({"type": "http.response.start", "status": 200, "headers": []})
        await send({"type": "http.response.body", "body": b"ok"})


async def _call(
    middleware: BodyLimitMiddleware,
    headers: list[tuple[bytes, bytes]],
    chunks: list[bytes],
    *,
    method: str = "POST",
    path: str = "/ingest/commit",
) -> list[dict[str, object]]:
    queue = [
        {"type": "http.request", "body": c, "more_body": i < len(chunks) - 1}
        for i, c in enumerate(chunks)
    ]
    sent: list[dict[str, object]] = []

    async def receive() -> dict[str, object]:
        return queue.pop(0) if queue else {"type": "http.disconnect"}

    async def send(message: dict[str, object]) -> None:
        sent.append(message)

    scope = {"type": "http", "method": method, "path": path, "headers": headers}
    await middleware(scope, receive, send)  # type: ignore[arg-type]
    return sent


def _limit(app: _Spy, ingest_max_bytes: int, max_bytes: int = 1000) -> BodyLimitMiddleware:
    return BodyLimitMiddleware(app, max_bytes=max_bytes, ingest_max_bytes=ingest_max_bytes)


async def test_a_declared_length_over_the_limit_never_reaches_the_app() -> None:
    spy = _Spy()
    sent = await _call(_limit(spy, 10), [(b"content-length", b"11")], [b"x" * 11])

    assert not spy.called
    assert sent[0]["status"] == 413


async def test_a_malformed_content_length_does_not_disable_the_stream_count() -> None:
    spy = _Spy()
    sent = await _call(_limit(spy, 10), [(b"content-length", b"abc")], [b"x" * 6, b"x" * 6])

    assert spy.called  # no se puede decidir por la cabecera, pero el flujo se cuenta
    assert sent[0]["status"] == 413 and len(sent) == 2  # un solo 413, sin respuestas dobles


async def test_a_body_within_the_limit_passes_through_untouched() -> None:
    spy = _Spy()
    sent = await _call(_limit(spy, 10), [], [b"x" * 6, b"x" * 4])

    assert spy.read == 10
    assert sent[0]["status"] == 200


@pytest.mark.parametrize(
    ("method", "path", "declared", "status"),
    [
        ("PATCH", "/x", b"6", 413),  # escritura fuera de la ingesta: límite general (5)
        ("PATCH", "/x", b"5", 200),  # justo en el límite general
        ("POST", "/ingest/pr", b"6", 200),  # la ingesta usa el suyo (10)
        ("GET", "/x", b"6", 200),  # una lectura no se limita
        ("DELETE", "/x", b"6", 200),
    ],
)
async def test_each_route_gets_its_own_limit_and_only_writes_are_limited(
    method: str, path: str, declared: bytes, status: int
) -> None:
    spy = _Spy()
    sent = await _call(
        _limit(spy, 10, max_bytes=5),
        [(b"content-length", declared)],
        [b"x" * int(declared)],
        method=method,
        path=path,
    )

    assert sent[0]["status"] == status
    assert spy.called is (status == 200)


async def test_a_chunked_patch_over_the_general_limit_is_cut_while_it_is_read() -> None:
    # Ninguna ruta usa PATCH (sin ruta, FastAPI da 405 sin leer el cuerpo): se prueba con una app
    # que sí lo lee, como haría una ruta futura.
    spy = _Spy()
    sent = await _call(
        _limit(spy, 100, max_bytes=5), [], [b"x" * 3, b"x" * 3], method="PATCH", path="/x"
    )

    assert sent[0]["status"] == 413 and len(sent) == 2
