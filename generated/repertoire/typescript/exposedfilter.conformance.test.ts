// generated: exposedfilter.conformance.test.ts
import { describe, it, expect } from "vitest";
import { createInMemoryStorage } from "@clef/runtime";
import { exposedfilterHandler } from "./exposedfilter.impl";

describe("ExposedFilter conformance", () => {

  it("invariant 1: after expose, collectInput, applyToQuery behaves correctly", async () => {
    const storage = createInMemoryStorage();

    let f = "u-test-invariant-001";
    let m = "u-test-invariant-002";

    // --- AFTER clause ---
    // expose(filter: f, fieldName: "status", operator: "eq", defaultValue: "active") -> ok(filter: f)
    const step1 = await exposedfilterHandler.expose(
      { filter: f, fieldName: "status", operator: "eq", defaultValue: "active" },
      storage,
    );
    expect(step1.variant).toBe("ok");
    f = (step1 as any).filter;

    // --- THEN clause ---
    // collectInput(filter: f, value: "archived") -> ok(filter: f)
    const step2 = await exposedfilterHandler.collectInput(
      { filter: f, value: "archived" },
      storage,
    );
    expect(step2.variant).toBe("ok");
    f = (step2 as any).filter;
    // applyToQuery(filter: f) -> ok(queryMod: m)
    const step3 = await exposedfilterHandler.applyToQuery(
      { filter: f },
      storage,
    );
    expect(step3.variant).toBe("ok");
    m = (step3 as any).queryMod;
  });

});
