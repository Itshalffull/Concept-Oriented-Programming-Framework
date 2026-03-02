import { describe, it, expect } from "vitest";
import { createInMemoryStorage } from "@clef/runtime";
import { bindingproviderHandler } from "./bindingprovider.impl";

describe("BindingProvider Concept – Behavioral Tests", () => {
  // ──────────────────────────────────────────────
  // initialize
  // ──────────────────────────────────────────────

  describe("initialize", () => {
    it("initializes successfully with valid config", async () => {
      const storage = createInMemoryStorage();
      const result = await bindingproviderHandler.initialize(
        { config: {} },
        storage,
      );
      expect(result.variant).toBe("ok");
      expect((result as any).provider).toBeTruthy();
      expect((result as any).pluginRef).toBe("surface-provider:binding");
    });

    it("returns configError when config is null", async () => {
      const storage = createInMemoryStorage();
      const result = await bindingproviderHandler.initialize(
        { config: null as any },
        storage,
      );
      expect(result.variant).toBe("configError");
    });

    it("is idempotent: second call returns same provider", async () => {
      const storage = createInMemoryStorage();
      const first = await bindingproviderHandler.initialize(
        { config: {} },
        storage,
      );
      const second = await bindingproviderHandler.initialize(
        { config: {} },
        storage,
      );
      expect((first as any).provider).toBe((second as any).provider);
    });
  });

  // ──────────────────────────────────────────────
  // bind
  // ──────────────────────────────────────────────

  describe("bind", () => {
    it("creates a one-way binding successfully", async () => {
      const storage = createInMemoryStorage();
      await bindingproviderHandler.initialize({ config: {} }, storage);
      const result = await bindingproviderHandler.bind(
        { bindingId: "b1", source: "model.name", target: "view.label", direction: "oneWay" },
        storage,
      );
      expect(result.variant).toBe("ok");
      expect((result as any).bindingId).toBe("b1");
    });

    it("creates a two-way binding successfully", async () => {
      const storage = createInMemoryStorage();
      await bindingproviderHandler.initialize({ config: {} }, storage);
      const result = await bindingproviderHandler.bind(
        { bindingId: "b2", source: "model.count", target: "view.counter", direction: "twoWay" },
        storage,
      );
      expect(result.variant).toBe("ok");
      expect((result as any).bindingId).toBe("b2");
    });

    it("returns duplicate when binding id already exists", async () => {
      const storage = createInMemoryStorage();
      await bindingproviderHandler.initialize({ config: {} }, storage);
      await bindingproviderHandler.bind(
        { bindingId: "b1", source: "model.a", target: "view.a", direction: "oneWay" },
        storage,
      );
      const result = await bindingproviderHandler.bind(
        { bindingId: "b1", source: "model.b", target: "view.b", direction: "oneWay" },
        storage,
      );
      expect(result.variant).toBe("duplicate");
      expect((result as any).message).toContain("b1");
    });

    it("returns invalid when source and target are the same", async () => {
      const storage = createInMemoryStorage();
      await bindingproviderHandler.initialize({ config: {} }, storage);
      const result = await bindingproviderHandler.bind(
        { bindingId: "b1", source: "model.x", target: "model.x", direction: "oneWay" },
        storage,
      );
      expect(result.variant).toBe("invalid");
    });

    it("returns invalid for unknown direction", async () => {
      const storage = createInMemoryStorage();
      await bindingproviderHandler.initialize({ config: {} }, storage);
      const result = await bindingproviderHandler.bind(
        { bindingId: "b1", source: "model.x", target: "view.x", direction: "threeWay" as any },
        storage,
      );
      expect(result.variant).toBe("invalid");
    });
  });

  // ──────────────────────────────────────────────
  // sync
  // ──────────────────────────────────────────────

  describe("sync", () => {
    it("synchronizes an existing binding", async () => {
      const storage = createInMemoryStorage();
      await bindingproviderHandler.initialize({ config: {} }, storage);
      await bindingproviderHandler.bind(
        { bindingId: "b1", source: "model.name", target: "view.label", direction: "oneWay" },
        storage,
      );
      const result = await bindingproviderHandler.sync(
        { bindingId: "b1" },
        storage,
      );
      expect(result.variant).toBe("ok");
      expect((result as any).synced).toBe(true);
    });

    it("returns notfound for a nonexistent binding", async () => {
      const storage = createInMemoryStorage();
      await bindingproviderHandler.initialize({ config: {} }, storage);
      const result = await bindingproviderHandler.sync(
        { bindingId: "ghost" },
        storage,
      );
      expect(result.variant).toBe("notfound");
    });
  });

  // ──────────────────────────────────────────────
  // invoke
  // ──────────────────────────────────────────────

  describe("invoke", () => {
    it("propagates a value through an existing binding", async () => {
      const storage = createInMemoryStorage();
      await bindingproviderHandler.initialize({ config: {} }, storage);
      await bindingproviderHandler.bind(
        { bindingId: "b1", source: "model.count", target: "view.counter", direction: "oneWay" },
        storage,
      );
      const result = await bindingproviderHandler.invoke(
        { bindingId: "b1", value: 42 },
        storage,
      );
      expect(result.variant).toBe("ok");
      expect((result as any).propagated).toBe(true);
    });

    it("returns notfound for a nonexistent binding", async () => {
      const storage = createInMemoryStorage();
      const result = await bindingproviderHandler.invoke(
        { bindingId: "ghost", value: "test" },
        storage,
      );
      expect(result.variant).toBe("notfound");
    });
  });

  // ──────────────────────────────────────────────
  // unbind
  // ──────────────────────────────────────────────

  describe("unbind", () => {
    it("removes an existing binding", async () => {
      const storage = createInMemoryStorage();
      await bindingproviderHandler.initialize({ config: {} }, storage);
      await bindingproviderHandler.bind(
        { bindingId: "b1", source: "model.name", target: "view.label", direction: "oneWay" },
        storage,
      );
      const result = await bindingproviderHandler.unbind(
        { bindingId: "b1" },
        storage,
      );
      expect(result.variant).toBe("ok");
      expect((result as any).bindingId).toBe("b1");
    });

    it("returns notfound for a nonexistent binding", async () => {
      const storage = createInMemoryStorage();
      const result = await bindingproviderHandler.unbind(
        { bindingId: "ghost" },
        storage,
      );
      expect(result.variant).toBe("notfound");
    });

    it("subsequent sync returns notfound after unbind", async () => {
      const storage = createInMemoryStorage();
      await bindingproviderHandler.initialize({ config: {} }, storage);
      await bindingproviderHandler.bind(
        { bindingId: "b1", source: "model.x", target: "view.x", direction: "twoWay" },
        storage,
      );
      await bindingproviderHandler.unbind({ bindingId: "b1" }, storage);
      const syncResult = await bindingproviderHandler.sync(
        { bindingId: "b1" },
        storage,
      );
      expect(syncResult.variant).toBe("notfound");
    });
  });

  // ──────────────────────────────────────────────
  // integration: full lifecycle
  // ──────────────────────────────────────────────

  describe("integration", () => {
    it("initialize -> bind -> invoke -> sync -> unbind full lifecycle", async () => {
      const storage = createInMemoryStorage();

      const initResult = await bindingproviderHandler.initialize(
        { config: {} },
        storage,
      );
      expect(initResult.variant).toBe("ok");

      const bindResult = await bindingproviderHandler.bind(
        { bindingId: "lifecycle", source: "model.value", target: "view.display", direction: "twoWay" },
        storage,
      );
      expect(bindResult.variant).toBe("ok");

      const invokeResult = await bindingproviderHandler.invoke(
        { bindingId: "lifecycle", value: "hello world" },
        storage,
      );
      expect(invokeResult.variant).toBe("ok");
      expect((invokeResult as any).propagated).toBe(true);

      const syncResult = await bindingproviderHandler.sync(
        { bindingId: "lifecycle" },
        storage,
      );
      expect(syncResult.variant).toBe("ok");

      const unbindResult = await bindingproviderHandler.unbind(
        { bindingId: "lifecycle" },
        storage,
      );
      expect(unbindResult.variant).toBe("ok");
    });
  });
});
