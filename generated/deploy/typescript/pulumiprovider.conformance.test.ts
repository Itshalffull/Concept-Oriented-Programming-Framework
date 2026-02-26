// generated: pulumiprovider.conformance.test.ts
import { describe, it, expect } from "vitest";
import { createInMemoryStorage } from "@clef/runtime";
import { pulumiproviderHandler } from "./pulumiprovider.impl";

describe("PulumiProvider conformance", () => {

  it("invariant 1: after generate, apply behaves correctly", async () => {
    const storage = createInMemoryStorage();

    let p = "u-test-invariant-001";
    let f = "u-test-invariant-002";
    let c = "u-test-invariant-003";
    let u = "u-test-invariant-004";

    // --- AFTER clause ---
    // generate(plan: "dp-001") -> ok(stack: p, files: f)
    const step1 = await pulumiproviderHandler.generate(
      { plan: "dp-001" },
      storage,
    );
    expect(step1.variant).toBe("ok");
    p = (step1 as any).stack;
    f = (step1 as any).files;

    // --- THEN clause ---
    // apply(stack: p) -> ok(stack: p, created: c, updated: u)
    const step2 = await pulumiproviderHandler.apply(
      { stack: p },
      storage,
    );
    expect(step2.variant).toBe("ok");
    p = (step2 as any).stack;
    c = (step2 as any).created;
    u = (step2 as any).updated;
  });

});
