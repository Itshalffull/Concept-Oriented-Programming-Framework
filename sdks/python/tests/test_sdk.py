"""
Tests for the COPF Python SDK.

Covers:
  - ConceptHandler dispatch
  - InMemoryStorage contract
  - Registry decorator
"""

import asyncio
import pytest

from copf.handler import ConceptHandler
from copf.storage import InMemoryStorage
from copf.registry import register, _REGISTRY


# ============================================================
# ConceptHandler Tests
# ============================================================


class EchoHandler(ConceptHandler):
    async def echo(self, input: dict, storage) -> dict:
        return {"variant": "ok", "message": input.get("message", "")}

    async def fail(self, input: dict, storage) -> dict:
        return {"variant": "error", "message": "intentional failure"}

    def not_async(self, input: dict, storage) -> dict:
        return {"variant": "ok"}


def test_handler_dispatches_to_correct_method():
    handler = EchoHandler()
    storage = InMemoryStorage()
    result = asyncio.run(handler.handle("echo", {"message": "hello"}, storage))
    assert result["variant"] == "ok"
    assert result["message"] == "hello"


def test_handler_returns_error_for_unknown_action():
    handler = EchoHandler()
    storage = InMemoryStorage()
    result = asyncio.run(handler.handle("nonexistent", {}, storage))
    assert result["variant"] == "error"
    assert "Unknown action" in result["message"]


def test_handler_returns_error_for_non_async_method():
    handler = EchoHandler()
    storage = InMemoryStorage()
    result = asyncio.run(handler.handle("not_async", {}, storage))
    assert result["variant"] == "error"
    assert "must be async" in result["message"]


def test_handler_passes_through_error_variant():
    handler = EchoHandler()
    storage = InMemoryStorage()
    result = asyncio.run(handler.handle("fail", {}, storage))
    assert result["variant"] == "error"
    assert result["message"] == "intentional failure"


# ============================================================
# InMemoryStorage Tests
# ============================================================


def test_storage_put_and_get():
    storage = InMemoryStorage()
    asyncio.run(storage.put("users", "alice", {"name": "Alice", "age": 30}))
    result = asyncio.run(storage.get("users", "alice"))
    assert result is not None
    assert result["name"] == "Alice"
    assert result["age"] == 30


def test_storage_get_returns_none_for_missing():
    storage = InMemoryStorage()
    result = asyncio.run(storage.get("users", "nonexistent"))
    assert result is None


def test_storage_put_overwrites():
    storage = InMemoryStorage()
    asyncio.run(storage.put("users", "alice", {"v": 1}))
    asyncio.run(storage.put("users", "alice", {"v": 2}))
    result = asyncio.run(storage.get("users", "alice"))
    assert result["v"] == 2


def test_storage_delete():
    storage = InMemoryStorage()
    asyncio.run(storage.put("users", "alice", {"name": "Alice"}))
    deleted = asyncio.run(storage.delete("users", "alice"))
    assert deleted is True
    result = asyncio.run(storage.get("users", "alice"))
    assert result is None


def test_storage_delete_returns_false_for_missing():
    storage = InMemoryStorage()
    deleted = asyncio.run(storage.delete("users", "nonexistent"))
    assert deleted is False


def test_storage_find_all():
    storage = InMemoryStorage()
    asyncio.run(storage.put("users", "alice", {"name": "Alice", "role": "admin"}))
    asyncio.run(storage.put("users", "bob", {"name": "Bob", "role": "user"}))
    results = asyncio.run(storage.find("users"))
    assert len(results) == 2


def test_storage_find_with_filter():
    storage = InMemoryStorage()
    asyncio.run(storage.put("users", "alice", {"name": "Alice", "role": "admin"}))
    asyncio.run(storage.put("users", "bob", {"name": "Bob", "role": "user"}))
    admins = asyncio.run(storage.find("users", {"role": "admin"}))
    assert len(admins) == 1
    assert admins[0]["name"] == "Alice"


def test_storage_find_empty_relation():
    storage = InMemoryStorage()
    results = asyncio.run(storage.find("empty"))
    assert results == []


def test_storage_isolates_relations():
    storage = InMemoryStorage()
    asyncio.run(storage.put("users", "k1", {"type": "user"}))
    asyncio.run(storage.put("posts", "k1", {"type": "post"}))
    users = asyncio.run(storage.find("users"))
    posts = asyncio.run(storage.find("posts"))
    assert len(users) == 1
    assert users[0]["type"] == "user"
    assert len(posts) == 1
    assert posts[0]["type"] == "post"


# ============================================================
# Registry Tests
# ============================================================


def test_register_decorator():
    # Clear previous registrations
    _REGISTRY.clear()

    @register("urn:test/Echo")
    class TestEchoHandler(ConceptHandler):
        async def echo(self, input: dict, storage) -> dict:
            return {"variant": "ok"}

    assert "urn:test/Echo" in _REGISTRY
    handler, storage = _REGISTRY["urn:test/Echo"]
    assert isinstance(handler, TestEchoHandler)
    assert isinstance(storage, InMemoryStorage)


def test_register_with_custom_storage():
    _REGISTRY.clear()
    custom_storage = InMemoryStorage()

    @register("urn:test/Custom", storage=custom_storage)
    class CustomHandler(ConceptHandler):
        async def do_thing(self, input: dict, storage) -> dict:
            return {"variant": "ok"}

    _, registered_storage = _REGISTRY["urn:test/Custom"]
    assert registered_storage is custom_storage


if __name__ == "__main__":
    pytest.main([__file__, "-v"])
