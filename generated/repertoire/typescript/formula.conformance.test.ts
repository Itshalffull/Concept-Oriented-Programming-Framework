// generated: formula.conformance.test.ts
import { describe, it, expect } from "vitest";
import { createInMemoryStorage } from "@clef/runtime";
import { formulaHandler } from "./formula.impl";

describe("Formula conformance", () => {

  it("invariant 1: after create, evaluate behaves correctly", async () => {
    const storage = createInMemoryStorage();

    const f = "u-test-invariant-001";

    // --- AFTER clause ---
    // create(formula: f, expression: "price * quantity") -> ok()
    const step1 = await formulaHandler.create(
      { formula: f, expression: "price * quantity" },
      storage,
    );
    expect(step1.variant).toBe("ok");

    // --- THEN clause ---
    // evaluate(formula: f) -> ok(result: "computed")
    const step2 = await formulaHandler.evaluate(
      { formula: f },
      storage,
    );
    expect(step2.variant).toBe("ok");
    expect((step2 as any).result).toBe("computed");
  });

});
