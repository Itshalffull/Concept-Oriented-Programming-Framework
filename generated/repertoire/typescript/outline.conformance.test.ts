// generated: outline.conformance.test.ts
import { describe, it, expect } from "vitest";
import { createInMemoryStorage } from "@clef/runtime";
import { outlineHandler } from "./outline.impl";

describe("Outline conformance", () => {

  it("invariant 1: after create, collapse, expand behaves correctly", async () => {
    const storage = createInMemoryStorage();

    let x = "u-test-invariant-001";

    // --- AFTER clause ---
    // create(node: x) -> ok(node: x)
    const step1 = await outlineHandler.create(
      { node: x },
      storage,
    );
    expect(step1.variant).toBe("ok");
    x = (step1 as any).node;
    // collapse(node: x) -> ok(node: x)
    const step2 = await outlineHandler.collapse(
      { node: x },
      storage,
    );
    expect(step2.variant).toBe("ok");
    x = (step2 as any).node;

    // --- THEN clause ---
    // expand(node: x) -> ok(node: x)
    const step3 = await outlineHandler.expand(
      { node: x },
      storage,
    );
    expect(step3.variant).toBe("ok");
    expect((step3 as any).node).toBe(x);
  });

});
