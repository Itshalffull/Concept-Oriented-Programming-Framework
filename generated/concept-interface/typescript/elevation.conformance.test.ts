// generated: elevation.conformance.test.ts
import { describe, it, expect } from "vitest";
import { createInMemoryStorage } from "@copf/runtime";
import { elevationHandler } from "./elevation.impl";

describe("Elevation conformance", () => {

  it("invariant 1: after define, get, define behaves correctly", async () => {
    const storage = createInMemoryStorage();

    const w = "u-test-invariant-001";
    const w2 = "u-test-invariant-002";

    // --- AFTER clause ---
    // define(elevation: w, level: 2, shadow: "[{ \"y\": 4, \"blur\": 8, \"color\": \"rgba(0,0,0,0.12)\" }]") -> ok(elevation: w)
    const step1 = await elevationHandler.define(
      { elevation: w, level: 2, shadow: "[{ \"y\": 4, \"blur\": 8, \"color\": \"rgba(0,0,0,0.12)\" }]" },
      storage,
    );
    expect(step1.variant).toBe("ok");
    expect((step1 as any).elevation).toBe(w);

    // --- THEN clause ---
    // get(elevation: w) -> ok(elevation: w, shadow: "[{ \"y\": 4, \"blur\": 8, \"color\": \"rgba(0,0,0,0.12)\" }]")
    const step2 = await elevationHandler.get(
      { elevation: w },
      storage,
    );
    expect(step2.variant).toBe("ok");
    expect((step2 as any).elevation).toBe(w);
    expect((step2 as any).shadow).toBe("[{ \"y\": 4, \"blur\": 8, \"color\": \"rgba(0,0,0,0.12)\" }]");
    // define(elevation: w2, level: 7, shadow: "[]") -> invalid(message: _)
    const step3 = await elevationHandler.define(
      { elevation: w2, level: 7, shadow: "[]" },
      storage,
    );
    expect(step3.variant).toBe("invalid");
    expect((step3 as any).message).toBeDefined();
  });

});
