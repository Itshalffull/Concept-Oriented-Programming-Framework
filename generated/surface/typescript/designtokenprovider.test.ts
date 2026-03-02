import { describe, it, expect } from "vitest";
import { createInMemoryStorage } from "@clef/runtime";
import { designtokenproviderHandler } from "./designtokenprovider.impl";

describe("DesignTokenProvider Concept – Behavioral Tests", () => {
  // ──────────────────────────────────────────────
  // initialize
  // ──────────────────────────────────────────────

  describe("initialize", () => {
    it("initializes successfully with valid config and returns provider id", async () => {
      const storage = createInMemoryStorage();
      const result = await designtokenproviderHandler.initialize(
        { config: { defaultTheme: "light" } },
        storage,
      );
      expect(result.variant).toBe("ok");
      expect((result as any).provider).toBeTruthy();
      expect((result as any).pluginRef).toBe("surface-provider:design-token");
    });

    it("returns configError when config is null", async () => {
      const storage = createInMemoryStorage();
      const result = await designtokenproviderHandler.initialize(
        { config: null as any },
        storage,
      );
      expect(result.variant).toBe("configError");
    });

    it("is idempotent: second call returns same provider", async () => {
      const storage = createInMemoryStorage();
      const first = await designtokenproviderHandler.initialize(
        { config: {} },
        storage,
      );
      const second = await designtokenproviderHandler.initialize(
        { config: {} },
        storage,
      );
      expect((first as any).provider).toBe((second as any).provider);
    });
  });

  // ──────────────────────────────────────────────
  // resolve
  // ──────────────────────────────────────────────

  describe("resolve", () => {
    it("returns notfound for a nonexistent token", async () => {
      const storage = createInMemoryStorage();
      await designtokenproviderHandler.initialize({ config: {} }, storage);
      const result = await designtokenproviderHandler.resolve(
        { tokenPath: "color.primary" },
        storage,
      );
      expect(result.variant).toBe("notfound");
    });
  });

  // ──────────────────────────────────────────────
  // switchTheme
  // ──────────────────────────────────────────────

  describe("switchTheme", () => {
    it("returns notfound when provider is not initialized", async () => {
      const storage = createInMemoryStorage();
      const result = await designtokenproviderHandler.switchTheme(
        { theme: "dark" },
        storage,
      );
      expect(result.variant).toBe("notfound");
    });

    it("returns notfound when theme has no registered tokens", async () => {
      const storage = createInMemoryStorage();
      await designtokenproviderHandler.initialize({ config: {} }, storage);
      const result = await designtokenproviderHandler.switchTheme(
        { theme: "nonexistent" },
        storage,
      );
      expect(result.variant).toBe("notfound");
      expect((result as any).message).toContain("nonexistent");
    });
  });

  // ──────────────────────────────────────────────
  // getTokens
  // ──────────────────────────────────────────────

  describe("getTokens", () => {
    it("returns an empty list when no tokens are registered", async () => {
      const storage = createInMemoryStorage();
      await designtokenproviderHandler.initialize({ config: {} }, storage);
      const result = await designtokenproviderHandler.getTokens({}, storage);
      expect(result.variant).toBe("ok");
      expect((result as any).tokens).toEqual([]);
    });
  });

  // ──────────────────────────────────────────────
  // export
  // ──────────────────────────────────────────────

  describe("export", () => {
    it("exports empty token set as JSON", async () => {
      const storage = createInMemoryStorage();
      await designtokenproviderHandler.initialize({ config: {} }, storage);
      const result = await designtokenproviderHandler.export(
        { format: "json" },
        storage,
      );
      expect(result.variant).toBe("ok");
      const parsed = JSON.parse((result as any).output);
      expect(typeof parsed).toBe("object");
    });

    it("exports empty token set as CSS", async () => {
      const storage = createInMemoryStorage();
      await designtokenproviderHandler.initialize({ config: {} }, storage);
      const result = await designtokenproviderHandler.export(
        { format: "css" },
        storage,
      );
      expect(result.variant).toBe("ok");
      expect((result as any).output).toContain(":root {");
    });

    it("returns unsupported for unknown format", async () => {
      const storage = createInMemoryStorage();
      const result = await designtokenproviderHandler.export(
        { format: "xml" },
        storage,
      );
      expect(result.variant).toBe("unsupported");
    });
  });

  // ──────────────────────────────────────────────
  // integration: full lifecycle
  // ──────────────────────────────────────────────

  describe("integration", () => {
    it("initialize -> getTokens -> export json round-trip", async () => {
      const storage = createInMemoryStorage();

      const initResult = await designtokenproviderHandler.initialize(
        { config: { defaultTheme: "light" } },
        storage,
      );
      expect(initResult.variant).toBe("ok");

      const tokensResult = await designtokenproviderHandler.getTokens({}, storage);
      expect(tokensResult.variant).toBe("ok");

      const exportResult = await designtokenproviderHandler.export(
        { format: "json" },
        storage,
      );
      expect(exportResult.variant).toBe("ok");
    });
  });
});
