"""
ConceptHandler base class.

Every concept handler extends this class and implements action methods.
The dispatch logic routes ActionInvocations to the correct method by name.
"""

from __future__ import annotations

import inspect
from typing import Any


class ConceptHandler:
    """Base class for COPF concept handlers.

    Subclasses implement async methods named after concept actions.
    The handler dispatches invocations to the matching method automatically.

    Example:
        class PasswordHandler(ConceptHandler):
            async def set(self, input: dict, storage: ConceptStorage) -> dict:
                hashed = hash_password(input["password"])
                await storage.put("credentials", input["userId"], {"hash": hashed})
                return {"variant": "ok", "userId": input["userId"]}

            async def verify(self, input: dict, storage: ConceptStorage) -> dict:
                cred = await storage.get("credentials", input["userId"])
                if cred and check_password(input["password"], cred["hash"]):
                    return {"variant": "ok", "userId": input["userId"]}
                return {"variant": "invalid"}
    """

    async def handle(self, action: str, input: dict[str, Any], storage: Any) -> dict[str, Any]:
        """Dispatch an action invocation to the named method.

        Args:
            action: The action name from the ActionInvocation.
            input: The input fields from the ActionInvocation.
            storage: A ConceptStorage instance for this concept.

        Returns:
            A dict with at minimum a "variant" key (the completion variant).

        Raises:
            AttributeError: If the action method doesn't exist on this handler.
            TypeError: If the action method is not async.
        """
        method = getattr(self, action, None)
        if method is None:
            return {"variant": "error", "message": f"Unknown action: {action}"}

        if not inspect.iscoroutinefunction(method):
            return {"variant": "error", "message": f"Action '{action}' must be async"}

        result = await method(input, storage)

        # Ensure result has a variant
        if not isinstance(result, dict) or "variant" not in result:
            return {"variant": "error", "message": f"Action '{action}' must return dict with 'variant' key"}

        return result
