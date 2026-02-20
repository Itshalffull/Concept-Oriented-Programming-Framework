import { describe, it, expect } from "vitest";
import { createInMemoryStorage } from "@copf/runtime";
import { elevationHandler } from "./elevation.impl";

describe("Elevation Concept – Behavioral Tests", () => {
  // ──────────────────────────────────────────────
  // define
  // ──────────────────────────────────────────────

  describe("define", () => {
    it("stores level 0 and returns ok", async () => {
      const storage = createInMemoryStorage();
      const result = await elevationHandler.define(
        { elevation: "e0", level: 0, shadow: "none" },
        storage,
      );
      expect(result.variant).toBe("ok");
      expect((result as any).elevation).toBe("e0");
    });

    it("stores level 5 and returns ok", async () => {
      const storage = createInMemoryStorage();
      const result = await elevationHandler.define(
        { elevation: "e5", level: 5, shadow: "0 16px 24px rgba(0,0,0,0.22)" },
        storage,
      );
      expect(result.variant).toBe("ok");
      expect((result as any).elevation).toBe("e5");
    });

    it("stores level 3 with shadow JSON and returns ok", async () => {
      const storage = createInMemoryStorage();
      const shadow = JSON.stringify([
        { x: 0, y: 4, blur: 8, spread: 0, color: "rgba(0,0,0,0.12)" },
      ]);
      const result = await elevationHandler.define(
        { elevation: "e3", level: 3, shadow },
        storage,
      );
      expect(result.variant).toBe("ok");

      const record = await storage.get("elevation", "e3");
      expect(record).toBeDefined();
      expect(record!.level).toBe(3);
      expect(record!.shadow).toBe(shadow);
    });

    it("returns invalid for level -1", async () => {
      const storage = createInMemoryStorage();
      const result = await elevationHandler.define(
        { elevation: "en1", level: -1, shadow: "none" },
        storage,
      );
      expect(result.variant).toBe("invalid");
      expect((result as any).message).toContain("-1");
    });

    it("returns invalid for level 6", async () => {
      const storage = createInMemoryStorage();
      const result = await elevationHandler.define(
        { elevation: "e6", level: 6, shadow: "0 20px 30px rgba(0,0,0,0.3)" },
        storage,
      );
      expect(result.variant).toBe("invalid");
      expect((result as any).message).toContain("6");
    });

    it("returns invalid for level 100", async () => {
      const storage = createInMemoryStorage();
      const result = await elevationHandler.define(
        { elevation: "e100", level: 100, shadow: "none" },
        storage,
      );
      expect(result.variant).toBe("invalid");
      expect((result as any).message).toContain("100");
    });
  });

  // ──────────────────────────────────────────────
  // get
  // ──────────────────────────────────────────────

  describe("get", () => {
    it("returns the stored shadow string exactly", async () => {
      const storage = createInMemoryStorage();
      const shadowValue = "0 2px 4px rgba(0,0,0,0.08)";
      await elevationHandler.define(
        { elevation: "e1", level: 1, shadow: shadowValue },
        storage,
      );

      const result = await elevationHandler.get(
        { elevation: "e1" },
        storage,
      );
      expect(result.variant).toBe("ok");
      expect((result as any).shadow).toBe(shadowValue);
      expect((result as any).elevation).toBe("e1");
    });

    it("returns notfound for a nonexistent elevation", async () => {
      const storage = createInMemoryStorage();
      const result = await elevationHandler.get(
        { elevation: "ghost" },
        storage,
      );
      expect(result.variant).toBe("notfound");
      expect((result as any).message).toContain("ghost");
    });
  });

  // ──────────────────────────────────────────────
  // generateScale
  // ──────────────────────────────────────────────

  describe("generateScale", () => {
    it("generates 6 levels (0-5) from a hex color (#000000)", async () => {
      const storage = createInMemoryStorage();
      const result = await elevationHandler.generateScale(
        { baseColor: "#000000" },
        storage,
      );
      expect(result.variant).toBe("ok");

      const shadows = JSON.parse((result as any).shadows);
      const keys = Object.keys(shadows);
      expect(keys).toHaveLength(6);
      expect(keys).toEqual(expect.arrayContaining(["0", "1", "2", "3", "4", "5"]));
    });

    it("generates 6 levels from an rgba color", async () => {
      const storage = createInMemoryStorage();
      const result = await elevationHandler.generateScale(
        { baseColor: "rgba(0,0,0,0.5)" },
        storage,
      );
      expect(result.variant).toBe("ok");

      const shadows = JSON.parse((result as any).shadows);
      expect(Object.keys(shadows)).toHaveLength(6);
    });

    it("returns invalid for a non-hex, non-rgba color", async () => {
      const storage = createInMemoryStorage();
      const result = await elevationHandler.generateScale(
        { baseColor: "blue" },
        storage,
      );
      expect(result.variant).toBe("invalid");
      expect((result as any).message).toContain("blue");
    });

    it("generates a scale from hex shorthand (#000)", async () => {
      const storage = createInMemoryStorage();
      const result = await elevationHandler.generateScale(
        { baseColor: "#000" },
        storage,
      );
      expect(result.variant).toBe("ok");

      const shadows = JSON.parse((result as any).shadows);
      expect(Object.keys(shadows)).toHaveLength(6);
    });

    it("level 0 has an empty shadow array", async () => {
      const storage = createInMemoryStorage();
      const result = await elevationHandler.generateScale(
        { baseColor: "#000000" },
        storage,
      );
      expect(result.variant).toBe("ok");

      const shadows = JSON.parse((result as any).shadows);
      expect(shadows["0"]).toEqual([]);
    });

    it("levels 1-5 have progressively larger shadows", async () => {
      const storage = createInMemoryStorage();
      const result = await elevationHandler.generateScale(
        { baseColor: "#000000" },
        storage,
      );
      expect(result.variant).toBe("ok");

      const shadows = JSON.parse((result as any).shadows);

      // Each level 1-5 should have shadow entries
      for (let i = 1; i <= 5; i++) {
        expect(shadows[String(i)].length).toBeGreaterThan(0);
      }

      // Verify progressive increase: y-offset and blur should increase with level
      let prevY = 0;
      let prevBlur = 0;
      for (let i = 1; i <= 5; i++) {
        const shadow = shadows[String(i)][0];
        expect(shadow.y).toBeGreaterThanOrEqual(prevY);
        expect(shadow.blur).toBeGreaterThanOrEqual(prevBlur);
        prevY = shadow.y;
        prevBlur = shadow.blur;
      }
    });
  });

  // ──────────────────────────────────────────────
  // integration
  // ──────────────────────────────────────────────

  describe("integration", () => {
    it("define level 2 -> get -> verify shadow matches -> define level 7 -> verify invalid", async () => {
      const storage = createInMemoryStorage();

      // Step 1: define level 2
      const shadowValue = "0 4px 8px rgba(0,0,0,0.12)";
      const defineResult = await elevationHandler.define(
        { elevation: "mid", level: 2, shadow: shadowValue },
        storage,
      );
      expect(defineResult.variant).toBe("ok");

      // Step 2: get and verify shadow matches
      const getResult = await elevationHandler.get(
        { elevation: "mid" },
        storage,
      );
      expect(getResult.variant).toBe("ok");
      expect((getResult as any).shadow).toBe(shadowValue);

      // Step 3: attempt to define level 7 (out of range)
      const invalidResult = await elevationHandler.define(
        { elevation: "too-high", level: 7, shadow: "big shadow" },
        storage,
      );
      expect(invalidResult.variant).toBe("invalid");
    });
  });
});
