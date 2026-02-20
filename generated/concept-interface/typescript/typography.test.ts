import { describe, it, expect } from "vitest";
import { createInMemoryStorage } from "@copf/runtime";
import { typographyHandler } from "./typography.impl";

describe("Typography Concept – Behavioral Tests", () => {
  // ──────────────────────────────────────────────
  // defineScale
  // ──────────────────────────────────────────────

  describe("defineScale", () => {
    it("generates xs, sm, base, lg, xl, 2xl for base=16, ratio=1.25, steps=3", async () => {
      const storage = createInMemoryStorage();
      const result = await typographyHandler.defineScale(
        { typography: "ts1", baseSize: 16, ratio: 1.25, steps: 3 },
        storage,
      );
      expect(result.variant).toBe("ok");

      const scale = JSON.parse((result as any).scale);
      const keys = Object.keys(scale);
      // steps=3 generates 3 above-base entries: lg, xl, 2xl
      // plus the fixed below-base entries: xs, sm, base
      expect(keys).toHaveLength(6);
      expect(keys).toContain("xs");
      expect(keys).toContain("sm");
      expect(keys).toContain("base");
      expect(keys).toContain("lg");
      expect(keys).toContain("xl");
      expect(keys).toContain("2xl");
    });

    it("returns correctly calculated values for the scale", async () => {
      const storage = createInMemoryStorage();
      const result = await typographyHandler.defineScale(
        { typography: "ts2", baseSize: 16, ratio: 1.25, steps: 3 },
        storage,
      );
      expect(result.variant).toBe("ok");

      const scale = JSON.parse((result as any).scale);
      // xs = base / ratio^2 = 16 / 1.5625 = 10.24
      expect(scale.xs).toBeCloseTo(10.24, 1);
      // sm = base / ratio = 16 / 1.25 = 12.8
      expect(scale.sm).toBeCloseTo(12.8, 1);
      // base = 16
      expect(scale.base).toBe(16);
      // lg = base * ratio = 20
      expect(scale.lg).toBe(20);
      // xl = base * ratio^2 = 25
      expect(scale.xl).toBe(25);
      // 2xl = base * ratio^3 = 31.25
      expect(scale["2xl"]).toBeCloseTo(31.25, 1);
    });

    it("returns invalid for baseSize=0", async () => {
      const storage = createInMemoryStorage();
      const result = await typographyHandler.defineScale(
        { typography: "ts3", baseSize: 0, ratio: 1.25, steps: 3 },
        storage,
      );
      expect(result.variant).toBe("invalid");
    });

    it("returns invalid for negative baseSize", async () => {
      const storage = createInMemoryStorage();
      const result = await typographyHandler.defineScale(
        { typography: "ts4", baseSize: -10, ratio: 1.25, steps: 3 },
        storage,
      );
      expect(result.variant).toBe("invalid");
    });

    it("returns invalid for ratio=0", async () => {
      const storage = createInMemoryStorage();
      const result = await typographyHandler.defineScale(
        { typography: "ts5", baseSize: 16, ratio: 0, steps: 3 },
        storage,
      );
      expect(result.variant).toBe("invalid");
    });

    it("returns invalid for negative ratio", async () => {
      const storage = createInMemoryStorage();
      const result = await typographyHandler.defineScale(
        { typography: "ts6", baseSize: 16, ratio: -1.5, steps: 3 },
        storage,
      );
      expect(result.variant).toBe("invalid");
    });

    it("returns invalid for steps=0", async () => {
      const storage = createInMemoryStorage();
      const result = await typographyHandler.defineScale(
        { typography: "ts7", baseSize: 16, ratio: 1.25, steps: 0 },
        storage,
      );
      expect(result.variant).toBe("invalid");
    });
  });

  // ──────────────────────────────────────────────
  // defineFontStack
  // ──────────────────────────────────────────────

  describe("defineFontStack", () => {
    it("creates a font stack with name, fonts, and category", async () => {
      const storage = createInMemoryStorage();
      const result = await typographyHandler.defineFontStack(
        {
          typography: "fs1",
          name: "heading",
          fonts: "Inter, Helvetica, Arial, sans-serif",
          category: "sans-serif",
        },
        storage,
      );
      expect(result.variant).toBe("ok");
      expect((result as any).typography).toBe("fs1");
    });

    it("returns duplicate for a font stack with the same name", async () => {
      const storage = createInMemoryStorage();
      await typographyHandler.defineFontStack(
        {
          typography: "fs1",
          name: "heading",
          fonts: "Inter, sans-serif",
          category: "sans-serif",
        },
        storage,
      );
      const result = await typographyHandler.defineFontStack(
        {
          typography: "fs2",
          name: "heading",
          fonts: "Roboto, sans-serif",
          category: "sans-serif",
        },
        storage,
      );
      expect(result.variant).toBe("duplicate");
      expect((result as any).message).toContain("heading");
    });

    it("allows two different font stack names", async () => {
      const storage = createInMemoryStorage();
      const result1 = await typographyHandler.defineFontStack(
        {
          typography: "fs1",
          name: "heading",
          fonts: "Inter, sans-serif",
          category: "sans-serif",
        },
        storage,
      );
      expect(result1.variant).toBe("ok");

      const result2 = await typographyHandler.defineFontStack(
        {
          typography: "fs2",
          name: "body",
          fonts: "Georgia, serif",
          category: "serif",
        },
        storage,
      );
      expect(result2.variant).toBe("ok");
    });
  });

  // ──────────────────────────────────────────────
  // defineStyle
  // ──────────────────────────────────────────────

  describe("defineStyle", () => {
    it("stores style config JSON successfully", async () => {
      const storage = createInMemoryStorage();
      const config = JSON.stringify({ fontSize: "16px", lineHeight: 1.5 });
      const result = await typographyHandler.defineStyle(
        { typography: "st1", name: "body-text", config },
        storage,
      );
      expect(result.variant).toBe("ok");
    });

    it("returns invalid for non-JSON config", async () => {
      const storage = createInMemoryStorage();
      const result = await typographyHandler.defineStyle(
        { typography: "st2", name: "broken-style", config: "not valid json {{{" },
        storage,
      );
      expect(result.variant).toBe("invalid");
      expect((result as any).message).toContain("Invalid config JSON");
    });

    it("returns invalid when config references scale but no scale exists", async () => {
      const storage = createInMemoryStorage();
      const config = JSON.stringify({ scale: "lg", fontWeight: "bold" });
      const result = await typographyHandler.defineStyle(
        { typography: "st3", name: "heading-style", config },
        storage,
      );
      expect(result.variant).toBe("invalid");
      expect((result as any).message).toContain("scale");
    });

    it("succeeds when config references scale and a scale exists", async () => {
      const storage = createInMemoryStorage();
      // First define a scale
      await typographyHandler.defineScale(
        { typography: "ts1", baseSize: 16, ratio: 1.25, steps: 3 },
        storage,
      );

      const config = JSON.stringify({ scale: "lg", fontWeight: "bold" });
      const result = await typographyHandler.defineStyle(
        { typography: "st4", name: "heading-style", config },
        storage,
      );
      expect(result.variant).toBe("ok");
    });

    it("succeeds when config has no scale reference even without a scale defined", async () => {
      const storage = createInMemoryStorage();
      const config = JSON.stringify({ fontSize: "14px", fontWeight: "normal" });
      const result = await typographyHandler.defineStyle(
        { typography: "st5", name: "caption-style", config },
        storage,
      );
      expect(result.variant).toBe("ok");
    });
  });

  // ──────────────────────────────────────────────
  // integration
  // ──────────────────────────────────────────────

  describe("integration", () => {
    it("defineScale -> defineFontStack -> defineStyle referencing scale -> all stored", async () => {
      const storage = createInMemoryStorage();

      // Step 1: define type scale
      const scaleResult = await typographyHandler.defineScale(
        { typography: "scale1", baseSize: 16, ratio: 1.333, steps: 4 },
        storage,
      );
      expect(scaleResult.variant).toBe("ok");

      // Step 2: define font stack
      const fontResult = await typographyHandler.defineFontStack(
        {
          typography: "font1",
          name: "sans",
          fonts: "Inter, Helvetica, Arial, sans-serif",
          category: "sans-serif",
        },
        storage,
      );
      expect(fontResult.variant).toBe("ok");

      // Step 3: define style referencing the scale
      const styleConfig = JSON.stringify({
        scale: "xl",
        fontFamily: "sans",
        fontWeight: "700",
        lineHeight: 1.2,
      });
      const styleResult = await typographyHandler.defineStyle(
        { typography: "style1", name: "h1", config: styleConfig },
        storage,
      );
      expect(styleResult.variant).toBe("ok");

      // Verify all entries are stored in storage
      const scaleRecord = await storage.get("typography", "scale1");
      expect(scaleRecord).toBeDefined();
      expect(scaleRecord!.kind).toBe("scale");

      const fontRecord = await storage.get("typography", "font1");
      expect(fontRecord).toBeDefined();
      expect(fontRecord!.kind).toBe("fontstack");

      const styleRecord = await storage.get("typography", "style1");
      expect(styleRecord).toBeDefined();
      expect(styleRecord!.kind).toBe("style");
    });
  });
});
