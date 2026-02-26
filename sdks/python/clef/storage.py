"""
ConceptStorage interface and in-memory implementation.

Each concept gets its own isolated storage instance, organized by relation.
This matches the TypeScript ConceptStorage interface (Section 6.8).
"""

from __future__ import annotations

import time
from typing import Any, Protocol


class ConceptStorage(Protocol):
    """Storage interface passed to every concept action handler."""

    async def get(self, relation: str, key: str) -> dict[str, Any] | None:
        """Get a single entry by key from a relation."""
        ...

    async def put(self, relation: str, key: str, value: dict[str, Any]) -> None:
        """Store an entry in a relation. Overwrites if key exists."""
        ...

    async def delete(self, relation: str, key: str) -> bool:
        """Delete an entry by key. Returns True if it existed."""
        ...

    async def find(
        self, relation: str, args: dict[str, Any] | None = None
    ) -> list[dict[str, Any]]:
        """Find entries in a relation, optionally filtered by args."""
        ...


class InMemoryStorage:
    """In-memory ConceptStorage implementation for testing and development.

    Data is organized as: relations[relation_name][key] = {value, meta}
    """

    def __init__(self) -> None:
        self._relations: dict[str, dict[str, dict[str, Any]]] = {}

    def _ensure_relation(self, relation: str) -> dict[str, dict[str, Any]]:
        if relation not in self._relations:
            self._relations[relation] = {}
        return self._relations[relation]

    async def get(self, relation: str, key: str) -> dict[str, Any] | None:
        rel = self._ensure_relation(relation)
        entry = rel.get(key)
        return entry["value"] if entry else None

    async def put(self, relation: str, key: str, value: dict[str, Any]) -> None:
        rel = self._ensure_relation(relation)
        rel[key] = {
            "value": value,
            "meta": {"lastWrittenAt": time.time()},
        }

    async def delete(self, relation: str, key: str) -> bool:
        rel = self._ensure_relation(relation)
        if key in rel:
            del rel[key]
            return True
        return False

    async def find(
        self, relation: str, args: dict[str, Any] | None = None
    ) -> list[dict[str, Any]]:
        rel = self._ensure_relation(relation)
        results = [entry["value"] for entry in rel.values()]
        if args:
            results = [
                r
                for r in results
                if all(r.get(k) == v for k, v in args.items())
            ]
        return results
