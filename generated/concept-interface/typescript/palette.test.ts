import { describe, it, expect } from "vitest";
import { createInMemoryStorage } from "@copf/runtime";
import { paletteHandler } from "./palette.impl";

describe("Palette Concept – Behavioral Tests", () => {
  // ──────────────────────────────────────────────
  // generate
  // ──────────────────────────────────────────────

  describe("generate", () => {
    it("generates a scale with 11 entries (50 through 950) from a valid hex color", async () => {
      const storage = createInMemoryStorage();
      const result = await paletteHandler.generate(
        { palette: "p1", name: "blue", seed: "#3b82f6" },
        storage,
      );
      expect(result.variant).toBe("ok");

      const scale = JSON.parse((result as any).scale);
      const keys = Object.keys(scale);
      expect(keys).toHaveLength(11);
      expect(keys).toEqual(
        expect.arrayContaining(["50", "100", "200", "300", "400", "500", "600", "700", "800", "900", "950"]),
      );
      // Each value should be a hex color
      for (const val of Object.values(scale)) {
        expect(val).toMatch(/^#[0-9a-f]{6}$/);
      }
    });

    it("accepts shorthand hex (#f00) and generates a valid scale", async () => {
      const storage = createInMemoryStorage();
      const result = await paletteHandler.generate(
        { palette: "p2", name: "red", seed: "#f00" },
        storage,
      );
      expect(result.variant).toBe("ok");

      const scale = JSON.parse((result as any).scale);
      expect(Object.keys(scale)).toHaveLength(11);
    });

    it("returns invalid for an invalid hex color (#gggggg)", async () => {
      const storage = createInMemoryStorage();
      const result = await paletteHandler.generate(
        { palette: "p3", name: "bad", seed: "#gggggg" },
        storage,
      );
      expect(result.variant).toBe("invalid");
      expect((result as any).message).toContain("#gggggg");
    });

    it("returns invalid for a non-hex format", async () => {
      const storage = createInMemoryStorage();
      const result = await paletteHandler.generate(
        { palette: "p4", name: "bad", seed: "rgb(255,0,0)" },
        storage,
      );
      expect(result.variant).toBe("invalid");
    });

    it("scale 50 is lightest and 950 is darkest", async () => {
      const storage = createInMemoryStorage();
      const result = await paletteHandler.generate(
        { palette: "p5", name: "blue", seed: "#3b82f6" },
        storage,
      );
      expect(result.variant).toBe("ok");

      const scale = JSON.parse((result as any).scale);
      // Parse hex to get luminance approximation (sum of RGB components)
      const hexToLuminance = (hex: string) => {
        const r = parseInt(hex.slice(1, 3), 16);
        const g = parseInt(hex.slice(3, 5), 16);
        const b = parseInt(hex.slice(5, 7), 16);
        return r + g + b;
      };

      const lum50 = hexToLuminance(scale["50"]);
      const lum950 = hexToLuminance(scale["950"]);
      expect(lum50).toBeGreaterThan(lum950); // 50 is lighter (higher RGB values)
    });
  });

  // ──────────────────────────────────────────────
  // assignRole
  // ──────────────────────────────────────────────

  describe("assignRole", () => {
    it("assigns a semantic role to an existing palette", async () => {
      const storage = createInMemoryStorage();
      await paletteHandler.generate(
        { palette: "p1", name: "blue", seed: "#3b82f6" },
        storage,
      );

      const result = await paletteHandler.assignRole(
        { palette: "p1", role: "primary" },
        storage,
      );
      expect(result.variant).toBe("ok");

      // Verify role is stored
      const record = await storage.get("palette", "p1");
      expect(record).toBeDefined();
      expect(record!.role).toBe("primary");
    });

    it("returns notfound for an invalid role", async () => {
      const storage = createInMemoryStorage();
      await paletteHandler.generate(
        { palette: "p1", name: "blue", seed: "#3b82f6" },
        storage,
      );

      const result = await paletteHandler.assignRole(
        { palette: "p1", role: "superspecial" },
        storage,
      );
      expect(result.variant).toBe("notfound");
      expect((result as any).message).toContain("superspecial");
    });

    it("returns notfound for a nonexistent palette", async () => {
      const storage = createInMemoryStorage();
      const result = await paletteHandler.assignRole(
        { palette: "ghost", role: "primary" },
        storage,
      );
      expect(result.variant).toBe("notfound");
    });
  });

  // ──────────────────────────────────────────────
  // checkContrast
  // ──────────────────────────────────────────────

  describe("checkContrast", () => {
    it("returns ratio ~21, passesAA=true, passesAAA=true for black vs white", async () => {
      const storage = createInMemoryStorage();
      const result = await paletteHandler.checkContrast(
        { foreground: "#000000", background: "#ffffff" },
        storage,
      );
      expect(result.variant).toBe("ok");
      expect((result as any).ratio).toBeGreaterThanOrEqual(20);
      expect((result as any).ratio).toBeLessThanOrEqual(21.1);
      expect((result as any).passesAA).toBe(true);
      expect((result as any).passesAAA).toBe(true);
    });

    it("returns ratio=1, passesAA=false, passesAAA=false for same color", async () => {
      const storage = createInMemoryStorage();
      const result = await paletteHandler.checkContrast(
        { foreground: "#888888", background: "#888888" },
        storage,
      );
      expect(result.variant).toBe("ok");
      expect((result as any).ratio).toBe(1);
      expect((result as any).passesAA).toBe(false);
      expect((result as any).passesAAA).toBe(false);
    });

    it("returns notfound for an invalid foreground color", async () => {
      const storage = createInMemoryStorage();
      const result = await paletteHandler.checkContrast(
        { foreground: "notacolor", background: "#ffffff" },
        storage,
      );
      expect(result.variant).toBe("notfound");
      expect((result as any).message).toContain("notacolor");
    });

    it("returns notfound for an invalid background color", async () => {
      const storage = createInMemoryStorage();
      const result = await paletteHandler.checkContrast(
        { foreground: "#000000", background: "invalid" },
        storage,
      );
      expect(result.variant).toBe("notfound");
      expect((result as any).message).toContain("invalid");
    });

    it("returns a mid-range ratio for mid-gray vs white", async () => {
      const storage = createInMemoryStorage();
      const result = await paletteHandler.checkContrast(
        { foreground: "#808080", background: "#ffffff" },
        storage,
      );
      expect(result.variant).toBe("ok");
      const ratio = (result as any).ratio;
      expect(ratio).toBeGreaterThan(1);
      expect(ratio).toBeLessThan(21);
    });
  });

  // ──────────────────────────────────────────────
  // integration
  // ──────────────────────────────────────────────

  describe("integration", () => {
    it("generate -> assignRole 'primary' -> checkContrast between scale endpoints", async () => {
      const storage = createInMemoryStorage();

      // Step 1: generate palette from seed
      const genResult = await paletteHandler.generate(
        { palette: "p1", name: "blue", seed: "#3b82f6" },
        storage,
      );
      expect(genResult.variant).toBe("ok");

      // Step 2: assign role
      const roleResult = await paletteHandler.assignRole(
        { palette: "p1", role: "primary" },
        storage,
      );
      expect(roleResult.variant).toBe("ok");

      // Step 3: check contrast between lightest (50) and darkest (950)
      const scale = JSON.parse((genResult as any).scale);
      const contrastResult = await paletteHandler.checkContrast(
        { foreground: scale["950"], background: scale["50"] },
        storage,
      );
      expect(contrastResult.variant).toBe("ok");
      // Scale endpoints should have high contrast
      expect((contrastResult as any).ratio).toBeGreaterThan(4.5);
      expect((contrastResult as any).passesAA).toBe(true);
    });
  });
});
