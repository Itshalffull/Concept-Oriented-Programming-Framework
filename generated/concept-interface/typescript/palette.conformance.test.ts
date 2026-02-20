// generated: palette.conformance.test.ts
import { describe, it, expect } from "vitest";
import { createInMemoryStorage } from "@copf/runtime";
import { paletteHandler } from "./palette.impl";

describe("Palette conformance", () => {

  it("invariant 1: after generate, assignRole behaves correctly", async () => {
    const storage = createInMemoryStorage();

    const c = "u-test-invariant-001";

    // --- AFTER clause ---
    // generate(palette: c, name: "blue", seed: "#3b82f6") -> ok(palette: c, scale: _)
    const step1 = await paletteHandler.generate(
      { palette: c, name: "blue", seed: "#3b82f6" },
      storage,
    );
    expect(step1.variant).toBe("ok");
    expect((step1 as any).palette).toBe(c);
    expect((step1 as any).scale).toBeDefined();

    // --- THEN clause ---
    // assignRole(palette: c, role: "primary") -> ok(palette: c)
    const step2 = await paletteHandler.assignRole(
      { palette: c, role: "primary" },
      storage,
    );
    expect(step2.variant).toBe("ok");
    expect((step2 as any).palette).toBe(c);
  });

});
