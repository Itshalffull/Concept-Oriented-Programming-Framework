import { describe, it, expect } from "vitest";
import { createInMemoryStorage } from "@clef/runtime";
import { viewportHandler } from "./viewport.impl";

describe("Viewport Concept", () => {
  // ---------------------------------------------------------------
  // observe
  // ---------------------------------------------------------------

  describe("observe", () => {
    it("1920x1080 resolves to xl breakpoint, landscape orientation", async () => {
      const storage = createInMemoryStorage();
      const result = await viewportHandler.observe(
        { viewport: "v-1", width: 1920, height: 1080 },
        storage,
      );
      expect(result.variant).toBe("ok");
      expect((result as any).breakpoint).toBe("xl");
      expect((result as any).orientation).toBe("landscape");
    });

    it("600x800 resolves to sm breakpoint, portrait orientation", async () => {
      const storage = createInMemoryStorage();
      const result = await viewportHandler.observe(
        { viewport: "v-1", width: 600, height: 800 },
        storage,
      );
      expect(result.variant).toBe("ok");
      expect((result as any).breakpoint).toBe("sm");
      expect((result as any).orientation).toBe("portrait");
    });

    it("768x1024 resolves to md breakpoint, portrait orientation", async () => {
      const storage = createInMemoryStorage();
      const result = await viewportHandler.observe(
        { viewport: "v-1", width: 768, height: 1024 },
        storage,
      );
      expect(result.variant).toBe("ok");
      expect((result as any).breakpoint).toBe("md");
      expect((result as any).orientation).toBe("portrait");
    });

    it("0x0 resolves to xs breakpoint, landscape (0 >= 0)", async () => {
      const storage = createInMemoryStorage();
      const result = await viewportHandler.observe(
        { viewport: "v-1", width: 0, height: 0 },
        storage,
      );
      expect(result.variant).toBe("ok");
      expect((result as any).breakpoint).toBe("xs");
      expect((result as any).orientation).toBe("landscape");
    });

    it("479x800 resolves to xs breakpoint, portrait", async () => {
      const storage = createInMemoryStorage();
      const result = await viewportHandler.observe(
        { viewport: "v-1", width: 479, height: 800 },
        storage,
      );
      expect(result.variant).toBe("ok");
      expect((result as any).breakpoint).toBe("xs");
      expect((result as any).orientation).toBe("portrait");
    });

    it("480x800 resolves to sm (exact boundary)", async () => {
      const storage = createInMemoryStorage();
      const result = await viewportHandler.observe(
        { viewport: "v-1", width: 480, height: 800 },
        storage,
      );
      expect(result.variant).toBe("ok");
      expect((result as any).breakpoint).toBe("sm");
    });

    it("1280x720 resolves to xl (exact boundary)", async () => {
      const storage = createInMemoryStorage();
      const result = await viewportHandler.observe(
        { viewport: "v-1", width: 1280, height: 720 },
        storage,
      );
      expect(result.variant).toBe("ok");
      expect((result as any).breakpoint).toBe("xl");
      expect((result as any).orientation).toBe("landscape");
    });
  });

  // ---------------------------------------------------------------
  // setBreakpoints
  // ---------------------------------------------------------------

  describe("setBreakpoints", () => {
    it("stores custom breakpoints that override defaults", async () => {
      const storage = createInMemoryStorage();
      const result = await viewportHandler.setBreakpoints(
        {
          viewport: "v-1",
          breakpoints: JSON.stringify({ small: 0, medium: 600, large: 1200 }),
        },
        storage,
      );
      expect(result.variant).toBe("ok");

      const record = await storage.get("viewport", "v-1");
      expect(record).not.toBeNull();
      const custom = JSON.parse(record!.customBreakpoints as string);
      expect(custom).toEqual({ small: 0, medium: 600, large: 1200 });
    });

    it("returns invalid for non-JSON breakpoints", async () => {
      const storage = createInMemoryStorage();
      const result = await viewportHandler.setBreakpoints(
        { viewport: "v-1", breakpoints: "not-json{{" },
        storage,
      );
      expect(result.variant).toBe("invalid");
    });

    it("returns invalid for an empty object", async () => {
      const storage = createInMemoryStorage();
      const result = await viewportHandler.setBreakpoints(
        { viewport: "v-1", breakpoints: "{}" },
        storage,
      );
      expect(result.variant).toBe("invalid");
      expect((result as any).message).toContain("at least one");
    });

    it("returns invalid for non-ascending threshold values", async () => {
      const storage = createInMemoryStorage();
      const result = await viewportHandler.setBreakpoints(
        {
          viewport: "v-1",
          breakpoints: JSON.stringify({ a: 0, b: 500, c: 500 }),
        },
        storage,
      );
      expect(result.variant).toBe("invalid");
      expect((result as any).message).toContain("ascending");
    });

    it("returns invalid for negative threshold values", async () => {
      const storage = createInMemoryStorage();
      const result = await viewportHandler.setBreakpoints(
        {
          viewport: "v-1",
          breakpoints: JSON.stringify({ small: -10, large: 500 }),
        },
        storage,
      );
      expect(result.variant).toBe("invalid");
      expect((result as any).message).toContain("non-negative");
    });

    it("returns invalid for duplicate threshold values", async () => {
      const storage = createInMemoryStorage();
      const result = await viewportHandler.setBreakpoints(
        {
          viewport: "v-1",
          breakpoints: JSON.stringify({ xs: 0, sm: 480, md: 480 }),
        },
        storage,
      );
      expect(result.variant).toBe("invalid");
      expect((result as any).message).toContain("ascending");
    });

    it("recalculates breakpoint when viewport was already observed", async () => {
      const storage = createInMemoryStorage();

      // First observe with default breakpoints
      await viewportHandler.observe(
        { viewport: "v-1", width: 1000, height: 800 },
        storage,
      );

      // Verify initial breakpoint is lg (1000 >= 768 but < 1024... actually 1000 < 1024 so md)
      let record = await storage.get("viewport", "v-1");
      expect(record!.breakpoint).toBe("md");

      // Set custom breakpoints where 1000 falls into "large"
      await viewportHandler.setBreakpoints(
        {
          viewport: "v-1",
          breakpoints: JSON.stringify({ small: 0, medium: 500, large: 900, xlarge: 1400 }),
        },
        storage,
      );

      // Breakpoint should be recalculated to "large" (1000 >= 900 but < 1400)
      record = await storage.get("viewport", "v-1");
      expect(record!.breakpoint).toBe("large");
    });
  });

  // ---------------------------------------------------------------
  // getBreakpoint
  // ---------------------------------------------------------------

  describe("getBreakpoint", () => {
    it("returns current breakpoint, width, and height after observation", async () => {
      const storage = createInMemoryStorage();
      await viewportHandler.observe(
        { viewport: "v-1", width: 1024, height: 768 },
        storage,
      );

      const result = await viewportHandler.getBreakpoint(
        { viewport: "v-1" },
        storage,
      );
      expect(result.variant).toBe("ok");
      expect((result as any).breakpoint).toBe("lg");
      expect((result as any).width).toBe(1024);
      expect((result as any).height).toBe(768);
    });

    it("returns notfound for a nonexistent viewport", async () => {
      const storage = createInMemoryStorage();
      const result = await viewportHandler.getBreakpoint(
        { viewport: "v-missing" },
        storage,
      );
      expect(result.variant).toBe("notfound");
      expect((result as any).message).toContain("v-missing");
    });
  });

  // ---------------------------------------------------------------
  // integration
  // ---------------------------------------------------------------

  describe("integration", () => {
    it("observe 1920x1080 -> setBreakpoints custom -> observe 1000x800 -> verify medium", async () => {
      const storage = createInMemoryStorage();

      // Step 1: observe at full HD
      const obs1 = await viewportHandler.observe(
        { viewport: "v-main", width: 1920, height: 1080 },
        storage,
      );
      expect(obs1.variant).toBe("ok");
      expect((obs1 as any).breakpoint).toBe("xl");
      expect((obs1 as any).orientation).toBe("landscape");

      // Step 2: set custom breakpoints
      const setBp = await viewportHandler.setBreakpoints(
        {
          viewport: "v-main",
          breakpoints: JSON.stringify({ small: 0, medium: 960, large: 1440 }),
        },
        storage,
      );
      expect(setBp.variant).toBe("ok");

      // After setting breakpoints, the stored breakpoint is recalculated for existing dimensions (1920)
      let record = await storage.get("viewport", "v-main");
      expect(record!.breakpoint).toBe("large"); // 1920 >= 1440

      // Step 3: observe at 1000x800
      const obs2 = await viewportHandler.observe(
        { viewport: "v-main", width: 1000, height: 800 },
        storage,
      );
      expect(obs2.variant).toBe("ok");
      expect((obs2 as any).breakpoint).toBe("medium"); // 1000 >= 960 but < 1440
      expect((obs2 as any).orientation).toBe("landscape");

      // Verify via getBreakpoint
      const bp = await viewportHandler.getBreakpoint(
        { viewport: "v-main" },
        storage,
      );
      expect(bp.variant).toBe("ok");
      expect((bp as any).breakpoint).toBe("medium");
      expect((bp as any).width).toBe(1000);
      expect((bp as any).height).toBe(800);
    });

    it("setBreakpoints first -> observe -> verify custom breakpoints are used", async () => {
      const storage = createInMemoryStorage();

      // Step 1: set custom breakpoints before any observation
      const setBp = await viewportHandler.setBreakpoints(
        {
          viewport: "v-pre",
          breakpoints: JSON.stringify({ tiny: 0, normal: 400, wide: 800, massive: 1600 }),
        },
        storage,
      );
      expect(setBp.variant).toBe("ok");

      // Record should exist with width=0, height=0, breakpoint='tiny'
      let record = await storage.get("viewport", "v-pre");
      expect(record!.breakpoint).toBe("tiny");
      expect(record!.width).toBe(0);

      // Step 2: observe at 900x600
      const obs = await viewportHandler.observe(
        { viewport: "v-pre", width: 900, height: 600 },
        storage,
      );
      expect(obs.variant).toBe("ok");
      expect((obs as any).breakpoint).toBe("wide"); // 900 >= 800 but < 1600
      expect((obs as any).orientation).toBe("landscape");

      // Step 3: observe at 1700x900
      const obs2 = await viewportHandler.observe(
        { viewport: "v-pre", width: 1700, height: 900 },
        storage,
      );
      expect(obs2.variant).toBe("ok");
      expect((obs2 as any).breakpoint).toBe("massive"); // 1700 >= 1600
    });
  });
});
