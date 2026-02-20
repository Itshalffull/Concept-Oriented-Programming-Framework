// generated: typography.conformance.test.ts
import { describe, it, expect } from "vitest";
import { createInMemoryStorage } from "@copf/runtime";
import { typographyHandler } from "./typography.impl";

describe("Typography conformance", () => {

  it("invariant 1: after defineScale, defineStyle behaves correctly", async () => {
    const storage = createInMemoryStorage();

    const x = "u-test-invariant-001";

    // --- AFTER clause ---
    // defineScale(typography: x, baseSize: 16, ratio: 1.25, steps: 6) -> ok(typography: x, scale: _)
    const step1 = await typographyHandler.defineScale(
      { typography: x, baseSize: 16, ratio: 1.25, steps: 6 },
      storage,
    );
    expect(step1.variant).toBe("ok");
    expect((step1 as any).typography).toBe(x);
    expect((step1 as any).scale).toBeDefined();

    // --- THEN clause ---
    // defineStyle(typography: x, name: "heading-1", config: "{ \"scale\": \"3xl\", \"weight\": 700 }") -> ok(typography: x)
    const step2 = await typographyHandler.defineStyle(
      { typography: x, name: "heading-1", config: "{ \"scale\": \"3xl\", \"weight\": 700 }" },
      storage,
    );
    expect(step2.variant).toBe("ok");
    expect((step2 as any).typography).toBe(x);
  });

});
