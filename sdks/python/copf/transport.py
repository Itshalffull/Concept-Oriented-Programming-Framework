"""
HTTP transport server for COPF concept handlers.

Starts an HTTP server that speaks the COPF wire protocol:
  POST /invoke → ActionInvocation → handler → ActionCompletion
  POST /query  → ConceptQuery → storage.find → results
  GET  /health → {"healthy": true, "latencyMs": 0}

Uses aiohttp for async HTTP. Falls back to built-in http.server if aiohttp
is not installed (sync mode, for simple testing).
"""

from __future__ import annotations

import json
import time
import uuid
from typing import Any

from copf.registry import _REGISTRY
from copf.storage import InMemoryStorage


async def _handle_invoke(body: dict[str, Any]) -> dict[str, Any]:
    """Process an ActionInvocation and return an ActionCompletion."""
    concept_uri = body.get("concept", "")
    action = body.get("action", "")
    input_data = body.get("input", {})
    flow = body.get("flow", str(uuid.uuid4()))
    invocation_id = body.get("id", str(uuid.uuid4()))

    entry = _REGISTRY.get(concept_uri)
    if entry is None:
        return {
            "id": invocation_id,
            "concept": concept_uri,
            "action": action,
            "input": input_data,
            "variant": "error",
            "output": {"variant": "error", "message": f"Unknown concept: {concept_uri}"},
            "flow": flow,
            "timestamp": time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime()),
        }

    handler, storage = entry
    result = await handler.handle(action, input_data, storage)
    variant = result.get("variant", "ok")

    return {
        "id": invocation_id,
        "concept": concept_uri,
        "action": action,
        "input": input_data,
        "variant": variant,
        "output": result,
        "flow": flow,
        "timestamp": time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime()),
    }


async def _handle_query(body: dict[str, Any]) -> list[dict[str, Any]]:
    """Process a ConceptQuery and return results."""
    concept_uri = body.get("concept", "")
    relation = body.get("relation", "")
    args = body.get("args")

    entry = _REGISTRY.get(concept_uri)
    if entry is None:
        return []

    _, storage = entry
    return await storage.find(relation, args)


def serve(host: str = "0.0.0.0", port: int = 8090) -> None:
    """Start the HTTP transport server.

    Serves all registered concept handlers on the given host:port.

    Routes:
        POST /invoke → ActionInvocation handling
        POST /query  → State queries
        GET  /health → Health check
    """
    try:
        from aiohttp import web
    except ImportError:
        _serve_stdlib(host, port)
        return

    async def invoke_handler(request: web.Request) -> web.Response:
        body = await request.json()
        result = await _handle_invoke(body)
        return web.json_response(result)

    async def query_handler(request: web.Request) -> web.Response:
        body = await request.json()
        result = await _handle_query(body)
        return web.json_response(result)

    async def health_handler(request: web.Request) -> web.Response:
        return web.json_response({"healthy": True, "latencyMs": 0})

    app = web.Application()
    app.router.add_post("/invoke", invoke_handler)
    app.router.add_post("/query", query_handler)
    app.router.add_get("/health", health_handler)

    registered = list(_REGISTRY.keys())
    print(f"COPF Python SDK v0.1.0")
    print(f"Serving {len(registered)} concept(s) on {host}:{port}")
    for uri in registered:
        print(f"  - {uri}")

    web.run_app(app, host=host, port=port)


def _serve_stdlib(host: str, port: int) -> None:
    """Fallback server using stdlib http.server (sync, for testing only)."""
    import asyncio
    from http.server import HTTPServer, BaseHTTPRequestHandler

    class Handler(BaseHTTPRequestHandler):
        def do_POST(self) -> None:
            length = int(self.headers.get("Content-Length", 0))
            body = json.loads(self.rfile.read(length)) if length > 0 else {}

            if self.path == "/invoke":
                result = asyncio.run(_handle_invoke(body))
            elif self.path == "/query":
                result = asyncio.run(_handle_query(body))
            else:
                self.send_error(404)
                return

            response = json.dumps(result).encode()
            self.send_response(200)
            self.send_header("Content-Type", "application/json")
            self.send_header("Content-Length", str(len(response)))
            self.end_headers()
            self.wfile.write(response)

        def do_GET(self) -> None:
            if self.path == "/health":
                response = json.dumps({"healthy": True, "latencyMs": 0}).encode()
                self.send_response(200)
                self.send_header("Content-Type", "application/json")
                self.send_header("Content-Length", str(len(response)))
                self.end_headers()
                self.wfile.write(response)
            else:
                self.send_error(404)

        def log_message(self, format: str, *args: Any) -> None:
            pass  # Suppress default logging

    registered = list(_REGISTRY.keys())
    print(f"COPF Python SDK v0.1.0 (stdlib fallback — install aiohttp for async)")
    print(f"Serving {len(registered)} concept(s) on {host}:{port}")
    for uri in registered:
        print(f"  - {uri}")

    server = HTTPServer((host, port), Handler)
    server.serve_forever()
