import { describe, it, expect } from "vitest";
import { createInMemoryStorage } from "@copf/runtime";
import { bindingHandler } from "./binding.impl";

describe("Binding Concept – Behavioral Tests", () => {
  // ──────────────────────────────────────────────
  // bind
  // ──────────────────────────────────────────────

  describe("bind", () => {
    it("creates a rest binding and sets endpoint to /conceptName", async () => {
      const storage = createInMemoryStorage();
      const result = await bindingHandler.bind(
        { binding: "b1", concept: "UserProfile", mode: "rest" },
        storage,
      );
      expect(result.variant).toBe("ok");
      expect((result as any).binding).toBe("b1");

      // Verify endpoint was set
      const entry = await storage.get("binding", "b1");
      expect(entry!.endpoint).toBe("/UserProfile");
      expect(entry!.status).toBe("bound");
    });

    it("creates a static binding with endpoint set to null", async () => {
      const storage = createInMemoryStorage();
      const result = await bindingHandler.bind(
        { binding: "b1", concept: "StaticPage", mode: "static" },
        storage,
      );
      expect(result.variant).toBe("ok");

      const entry = await storage.get("binding", "b1");
      expect(entry!.endpoint).toBeNull();
    });

    it("returns invalid for an unrecognized mode", async () => {
      const storage = createInMemoryStorage();
      const result = await bindingHandler.bind(
        { binding: "b1", concept: "Foo", mode: "websocket" },
        storage,
      );
      expect(result.variant).toBe("invalid");
      expect((result as any).message).toContain("websocket");
    });

    it("accepts all 4 valid modes (coupled, rest, graphql, static)", async () => {
      const validModes = ["coupled", "rest", "graphql", "static"];
      for (const mode of validModes) {
        const storage = createInMemoryStorage();
        const result = await bindingHandler.bind(
          { binding: `b-${mode}`, concept: "TestConcept", mode },
          storage,
        );
        expect(result.variant).toBe("ok");
      }
    });
  });

  // ──────────────────────────────────────────────
  // sync
  // ──────────────────────────────────────────────

  describe("sync", () => {
    it("updates lastSync timestamp and sets status to synced", async () => {
      const storage = createInMemoryStorage();
      await bindingHandler.bind(
        { binding: "b1", concept: "Counter", mode: "rest" },
        storage,
      );

      const result = await bindingHandler.sync({ binding: "b1" }, storage);
      expect(result.variant).toBe("ok");

      const entry = await storage.get("binding", "b1");
      expect(entry!.status).toBe("synced");
      expect(entry!.lastSync).toBeTruthy();
      // Verify it's a valid ISO date string
      expect(new Date(entry!.lastSync as string).toISOString()).toBe(entry!.lastSync);
    });

    it("returns error for a nonexistent binding", async () => {
      const storage = createInMemoryStorage();
      const result = await bindingHandler.sync({ binding: "ghost" }, storage);
      expect(result.variant).toBe("error");
      expect((result as any).message).toContain("ghost");
    });

    it("returns error for an unbound binding", async () => {
      const storage = createInMemoryStorage();
      await bindingHandler.bind(
        { binding: "b1", concept: "Counter", mode: "rest" },
        storage,
      );
      await bindingHandler.unbind({ binding: "b1" }, storage);

      const result = await bindingHandler.sync({ binding: "b1" }, storage);
      expect(result.variant).toBe("error");
      expect((result as any).message).toContain("unbound");
    });
  });

  // ──────────────────────────────────────────────
  // invoke
  // ──────────────────────────────────────────────

  describe("invoke", () => {
    it("returns ok with result JSON containing action, mode, and input", async () => {
      const storage = createInMemoryStorage();
      await bindingHandler.bind(
        { binding: "b1", concept: "Counter", mode: "rest" },
        storage,
      );

      const result = await bindingHandler.invoke(
        { binding: "b1", action: "increment", input: JSON.stringify({ amount: 5 }) },
        storage,
      );
      expect(result.variant).toBe("ok");

      const resultData = JSON.parse((result as any).result);
      expect(resultData.action).toBe("increment");
      expect(resultData.mode).toBe("rest");
      expect(resultData.input).toEqual({ amount: 5 });
      expect(resultData.concept).toBe("Counter");
      expect(resultData.status).toBe("completed");
    });

    it("returns error for invalid JSON input", async () => {
      const storage = createInMemoryStorage();
      await bindingHandler.bind(
        { binding: "b1", concept: "Counter", mode: "rest" },
        storage,
      );

      const result = await bindingHandler.invoke(
        { binding: "b1", action: "increment", input: "not valid json {{" },
        storage,
      );
      expect(result.variant).toBe("error");
      expect((result as any).message).toContain("Invalid input JSON");
    });

    it("returns error for a nonexistent binding", async () => {
      const storage = createInMemoryStorage();
      const result = await bindingHandler.invoke(
        { binding: "ghost", action: "increment", input: "{}" },
        storage,
      );
      expect(result.variant).toBe("error");
      expect((result as any).message).toContain("ghost");
    });

    it("returns error for an unbound binding", async () => {
      const storage = createInMemoryStorage();
      await bindingHandler.bind(
        { binding: "b1", concept: "Counter", mode: "rest" },
        storage,
      );
      await bindingHandler.unbind({ binding: "b1" }, storage);

      const result = await bindingHandler.invoke(
        { binding: "b1", action: "increment", input: "{}" },
        storage,
      );
      expect(result.variant).toBe("error");
      expect((result as any).message).toContain("unbound");
    });
  });

  // ──────────────────────────────────────────────
  // unbind
  // ──────────────────────────────────────────────

  describe("unbind", () => {
    it("marks the binding as unbound and clears the endpoint", async () => {
      const storage = createInMemoryStorage();
      await bindingHandler.bind(
        { binding: "b1", concept: "Counter", mode: "rest" },
        storage,
      );

      const result = await bindingHandler.unbind({ binding: "b1" }, storage);
      expect(result.variant).toBe("ok");

      const entry = await storage.get("binding", "b1");
      expect(entry!.status).toBe("unbound");
      expect(entry!.endpoint).toBeNull();
    });

    it("returns notfound for a nonexistent binding", async () => {
      const storage = createInMemoryStorage();
      const result = await bindingHandler.unbind({ binding: "ghost" }, storage);
      expect(result.variant).toBe("notfound");
    });
  });

  // ──────────────────────────────────────────────
  // integration
  // ──────────────────────────────────────────────

  describe("integration", () => {
    it("bind(rest) -> sync -> invoke -> unbind -> invoke again fails", async () => {
      const storage = createInMemoryStorage();

      // Step 1: bind with rest mode
      const bindResult = await bindingHandler.bind(
        { binding: "b1", concept: "TaskList", mode: "rest" },
        storage,
      );
      expect(bindResult.variant).toBe("ok");

      // Step 2: sync
      const syncResult = await bindingHandler.sync({ binding: "b1" }, storage);
      expect(syncResult.variant).toBe("ok");

      // Step 3: invoke an action
      const invokeResult = await bindingHandler.invoke(
        { binding: "b1", action: "addTask", input: JSON.stringify({ title: "Buy milk" }) },
        storage,
      );
      expect(invokeResult.variant).toBe("ok");

      // Step 4: unbind
      const unbindResult = await bindingHandler.unbind({ binding: "b1" }, storage);
      expect(unbindResult.variant).toBe("ok");

      // Step 5: attempt invoke again — should fail because it's unbound
      const invokeResult2 = await bindingHandler.invoke(
        { binding: "b1", action: "addTask", input: JSON.stringify({ title: "Buy eggs" }) },
        storage,
      );
      expect(invokeResult2.variant).toBe("error");
      expect((invokeResult2 as any).message).toContain("unbound");
    });
  });
});
