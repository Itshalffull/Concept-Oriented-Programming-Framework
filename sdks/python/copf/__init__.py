"""
COPF Python SDK — Thin protocol library for writing concept handlers in Python.

NOT a code generator. This SDK implements the handler/transport protocol so Python
developers can write concept handlers that communicate with the COPF sync engine
over HTTP. Target: ML pipeline concepts, data processing concepts, or any Python
service that should participate in COPF sync chains.

Usage:
    from copf import ConceptHandler, register

    @register("urn:app/Recommender")
    class RecommenderHandler(ConceptHandler):
        async def recommend(self, input: dict, storage: "ConceptStorage") -> dict:
            results = await run_ml_pipeline(input["userId"])
            return {"variant": "ok", "results": results}

    if __name__ == "__main__":
        from copf import serve
        serve(host="0.0.0.0", port=8090)

Architecture (Section 16.13):
    SDKs are pre-conceptual protocol libraries. They don't generate code, don't use
    ConceptManifest, and don't integrate with the compiler pipeline. They let external
    services speak the concept wire protocol (ActionInvocation → handler → ActionCompletion).
"""

from copf.handler import ConceptHandler
from copf.storage import ConceptStorage, InMemoryStorage
from copf.transport import serve
from copf.registry import register

__all__ = [
    "ConceptHandler",
    "ConceptStorage",
    "InMemoryStorage",
    "serve",
    "register",
]

__version__ = "0.1.0"
