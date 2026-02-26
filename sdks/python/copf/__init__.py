"""
Clef Python SDK — Thin protocol library for writing concept handlers in Python.

NOT a code generator. This SDK implements the handler/transport protocol so Python
developers can write concept handlers that communicate with the Clef sync engine
over HTTP. Target: ML pipeline concepts, data processing concepts, or any Python
service that should participate in Clef sync chains.

Usage:
    from clef import ConceptHandler, register

    @register("urn:app/Recommender")
    class RecommenderHandler(ConceptHandler):
        async def recommend(self, input: dict, storage: "ConceptStorage") -> dict:
            results = await run_ml_pipeline(input["userId"])
            return {"variant": "ok", "results": results}

    if __name__ == "__main__":
        from clef import serve
        serve(host="0.0.0.0", port=8090)

Architecture (Section 16.13):
    SDKs are pre-conceptual protocol libraries. They don't generate code, don't use
    ConceptManifest, and don't integrate with the compiler pipeline. They let external
    services speak the concept wire protocol (ActionInvocation → handler → ActionCompletion).
"""

from clef.handler import ConceptHandler
from clef.storage import ConceptStorage, InMemoryStorage
from clef.transport import serve
from clef.registry import register

__all__ = [
    "ConceptHandler",
    "ConceptStorage",
    "InMemoryStorage",
    "serve",
    "register",
]

__version__ = "0.1.0"
