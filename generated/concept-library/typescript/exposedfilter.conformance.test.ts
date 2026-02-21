// generated: exposedfilter.conformance.test.ts
import { describe, it, expect } from "vitest";
import { createInMemoryStorage } from "@copf/runtime";
import { exposedfilterHandler } from "./exposedfilter.impl";

describe("ExposedFilter conformance", () => {

  it("invariant 1: after expose, collectInput, applyToQuery behaves correctly", async () => {
    const storage = createInMemoryStorage();

    const f = "u-test-invariant-001";
    const m = "u-test-invariant-002";

    // --- AFTER clause ---
    // expose(filter: f, fieldName: "status", operator: "eq", defaultValue: "active") -> ok(filter: f)
    const step1 = await exposedfilterHandler.expose(
      { filter: f, fieldName: "status", operator: "eq", defaultValue: "active" },
      storage,
    );
    expect(step1.variant).toBe("ok");
    expect((step1 as any).filter).toBe(f);

    // --- THEN clause ---
    // collectInput(filter: f, value: "archived") -> ok(filter: f)
    const step2 = await exposedfilterHandler.collectInput(
      { filter: f, value: "archived" },
      storage,
    );
    expect(step2.variant).toBe("ok");
    expect((step2 as any).filter).toBe(f);
    // applyToQuery(filter: f) -> ok(queryMod: m)
    const step3 = await exposedfilterHandler.applyToQuery(
      { filter: f },
      storage,
    );
    expect(step3.variant).toBe("ok");
    expect((step3 as any).queryMod).toBe(m);
  });

});
