"""
Concept handler registry.

Maps concept URIs to (handler, storage) pairs. The @register decorator
adds a handler class to the registry with an auto-created InMemoryStorage.
"""

from __future__ import annotations

from typing import Any

from clef.storage import InMemoryStorage


# Global registry: concept_uri → (handler_instance, storage_instance)
_REGISTRY: dict[str, tuple[Any, Any]] = {}


def register(uri: str, storage: Any | None = None):
    """Decorator to register a concept handler class.

    Args:
        uri: The concept URI (e.g., "urn:app/Recommender").
        storage: Optional ConceptStorage instance. Defaults to InMemoryStorage.

    Usage:
        @register("urn:app/Recommender")
        class RecommenderHandler(ConceptHandler):
            async def recommend(self, input, storage):
                return {"variant": "ok", "results": [...]}
    """

    def decorator(cls: type) -> type:
        instance = cls()
        store = storage if storage is not None else InMemoryStorage()
        _REGISTRY[uri] = (instance, store)
        return cls

    return decorator
