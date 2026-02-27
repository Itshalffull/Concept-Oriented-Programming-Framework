// generated: cloudformationprovider.conformance.test.ts
import { describe, it, expect } from "vitest";
import { createInMemoryStorage } from "@clef/runtime";
import { cloudformationproviderHandler } from "./cloudformationprovider.impl";

describe("CloudFormationProvider conformance", () => {

  it("invariant 1: after generate, apply behaves correctly", async () => {
    const storage = createInMemoryStorage();

    let s = "u-test-invariant-001";
    let f = "u-test-invariant-002";
    let sid = "u-test-invariant-003";
    let c = "u-test-invariant-004";
    let u = "u-test-invariant-005";

    // --- AFTER clause ---
    // generate(plan: "dp-001") -> ok(stack: s, files: f)
    const step1 = await cloudformationproviderHandler.generate(
      { plan: "dp-001" },
      storage,
    );
    expect(step1.variant).toBe("ok");
    s = (step1 as any).stack;
    f = (step1 as any).files;

    // --- THEN clause ---
    // apply(stack: s) -> ok(stack: s, stackId: sid, created: c, updated: u)
    const step2 = await cloudformationproviderHandler.apply(
      { stack: s },
      storage,
    );
    expect(step2.variant).toBe("ok");
    s = (step2 as any).stack;
    sid = (step2 as any).stackId;
    c = (step2 as any).created;
    u = (step2 as any).updated;
  });

});
