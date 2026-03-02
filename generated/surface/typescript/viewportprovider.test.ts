import { describe, it, expect } from "vitest";
import { createInMemoryStorage } from "@clef/runtime";
import { viewportproviderHandler } from "./viewportprovider.impl";

describe("ViewportProvider Concept – Behavioral Tests", () => {
  // ──────────────────────────────────────────────
  // initialize
  // ──────────────────────────────────────────────

  describe("initialize", () => {
    it("initializes successfully with valid config and returns provider id", async () => {
      const storage = createInMemoryStorage();
      const result = await viewportproviderHandler.initialize(
        { config: {} },
        storage,
      );
      expect(result.variant).toBe("ok");
      expect((result as any).provider).toBeTruthy();
      expect((result as any).pluginRef).toBe("surface-provider:viewport");
    });

    it("returns configError when config is null", async () => {
      const storage = createInMemoryStorage();
      const result = await viewportproviderHandler.initialize(
        { config: null as any },
        storage,
      );
      expect(result.variant).toBe("configError");
    });

    it("is idempotent: second call returns same provider", async () => {
      const storage = createInMemoryStorage();
      const first = await viewportproviderHandler.initialize(
        { config: {} },
        storage,
      );
      const second = await viewportproviderHandler.initialize(
        { config: {} },
        storage,
      );
      expect((first as any).provider).toBe((second as any).provider);
    });
  });

  // ──────────────────────────────────────────────
  // observe
  // ──────────────────────────────────────────────

  describe("observe", () => {
    it("returns notfound when no observation is registered for the target", async () => {
      const storage = createInMemoryStorage();
      await viewportproviderHandler.initialize({ config: {} }, storage);
      const result = await viewportproviderHandler.observe(
        { target: "main-viewport" },
        storage,
      );
      expect(result.variant).toBe("notfound");
      expect((result as any).message).toContain("main-viewport");
    });
  });

  // ──────────────────────────────────────────────
  // getBreakpoint
  // ──────────────────────────────────────────────

  describe("getBreakpoint", () => {
    it("returns xs breakpoint for small width", async () => {
      const storage = createInMemoryStorage();
      await viewportproviderHandler.initialize({ config: {} }, storage);
      const result = await viewportproviderHandler.getBreakpoint(
        { width: 320 },
        storage,
      );
      expect(result.variant).toBe("ok");
      expect((result as any).breakpoint).toBe("xs");
    });

    it("returns md breakpoint for medium width", async () => {
      const storage = createInMemoryStorage();
      await viewportproviderHandler.initialize({ config: {} }, storage);
      const result = await viewportproviderHandler.getBreakpoint(
        { width: 800 },
        storage,
      );
      expect(result.variant).toBe("ok");
      expect((result as any).breakpoint).toBe("md");
    });

    it("returns xl breakpoint for large width", async () => {
      const storage = createInMemoryStorage();
      await viewportproviderHandler.initialize({ config: {} }, storage);
      const result = await viewportproviderHandler.getBreakpoint(
        { width: 1400 },
        storage,
      );
      expect(result.variant).toBe("ok");
      expect((result as any).breakpoint).toBe("xl");
    });
  });

  // ──────────────────────────────────────────────
  // setBreakpoints
  // ──────────────────────────────────────────────

  describe("setBreakpoints", () => {
    it("replaces breakpoints with custom configuration", async () => {
      const storage = createInMemoryStorage();
      await viewportproviderHandler.initialize({ config: {} }, storage);

      const result = await viewportproviderHandler.setBreakpoints(
        {
          breakpoints: [
            { name: "mobile", minWidth: 0, maxWidth: 599 },
            { name: "tablet", minWidth: 600, maxWidth: 1023 },
            { name: "desktop", minWidth: 1024, maxWidth: null },
          ],
        },
        storage,
      );
      expect(result.variant).toBe("ok");
      expect((result as any).count).toBe(3);

      // Verify the new breakpoints are active
      const bpResult = await viewportproviderHandler.getBreakpoint(
        { width: 700 },
        storage,
      );
      expect((bpResult as any).breakpoint).toBe("tablet");
    });

    it("returns invalid for empty breakpoints array", async () => {
      const storage = createInMemoryStorage();
      await viewportproviderHandler.initialize({ config: {} }, storage);

      const result = await viewportproviderHandler.setBreakpoints(
        { breakpoints: [] },
        storage,
      );
      expect(result.variant).toBe("invalid");
    });

    it("returns invalid for overlapping breakpoint ranges", async () => {
      const storage = createInMemoryStorage();
      await viewportproviderHandler.initialize({ config: {} }, storage);

      const result = await viewportproviderHandler.setBreakpoints(
        {
          breakpoints: [
            { name: "small", minWidth: 0, maxWidth: 800 },
            { name: "medium", minWidth: 600, maxWidth: 1200 },
          ],
        },
        storage,
      );
      expect(result.variant).toBe("invalid");
      expect((result as any).message).toContain("overlapping");
    });
  });

  // ──────────────────────────────────────────────
  // integration: full lifecycle
  // ──────────────────────────────────────────────

  describe("integration", () => {
    it("initialize -> setBreakpoints -> getBreakpoint verifies custom config", async () => {
      const storage = createInMemoryStorage();

      const initResult = await viewportproviderHandler.initialize(
        { config: {} },
        storage,
      );
      expect(initResult.variant).toBe("ok");

      const setResult = await viewportproviderHandler.setBreakpoints(
        {
          breakpoints: [
            { name: "compact", minWidth: 0, maxWidth: 599 },
            { name: "regular", minWidth: 600, maxWidth: null },
          ],
        },
        storage,
      );
      expect(setResult.variant).toBe("ok");

      const bpResult = await viewportproviderHandler.getBreakpoint(
        { width: 300 },
        storage,
      );
      expect((bpResult as any).breakpoint).toBe("compact");

      const bpResult2 = await viewportproviderHandler.getBreakpoint(
        { width: 900 },
        storage,
      );
      expect((bpResult2 as any).breakpoint).toBe("regular");
    });
  });
});
