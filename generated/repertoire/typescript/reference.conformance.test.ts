// generated: reference.conformance.test.ts
import { describe, it, expect } from "vitest";
import { createInMemoryStorage } from "@clef/runtime";
import { referenceHandler } from "./reference.impl";

describe("Reference conformance", () => {

  it("invariant 1: after addRef, getRefs behaves correctly", async () => {
    const storage = createInMemoryStorage();

    const x = "u-test-invariant-001";

    // --- AFTER clause ---
    // addRef(source: x, target: "doc-1") -> ok(source: x, target: "doc-1")
    const step1 = await referenceHandler.addRef(
      { source: x, target: "doc-1" },
      storage,
    );
    expect(step1.variant).toBe("ok");
    expect((step1 as any).source).toBe(x);
    expect((step1 as any).target).toBe("doc-1");

    // --- THEN clause ---
    // getRefs(source: x) -> ok(targets: "doc-1")
    const step2 = await referenceHandler.getRefs(
      { source: x },
      storage,
    );
    expect(step2.variant).toBe("ok");
    expect((step2 as any).targets).toBe("doc-1");
  });

});
