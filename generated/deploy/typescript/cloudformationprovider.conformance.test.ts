// generated: cloudformationprovider.conformance.test.ts
import { describe, it, expect } from "vitest";
import { createInMemoryStorage } from "@copf/runtime";
import { cloudformationproviderHandler } from "./cloudformationprovider.impl";

describe("CloudFormationProvider conformance", () => {

  it("invariant 1: after generate, apply behaves correctly", async () => {
    const storage = createInMemoryStorage();

    const s = "u-test-invariant-001";
    const f = "u-test-invariant-002";
    const sid = "u-test-invariant-003";
    const c = "u-test-invariant-004";
    const u = "u-test-invariant-005";

    // --- AFTER clause ---
    // generate(plan: "dp-001") -> ok(stack: s, files: f)
    const step1 = await cloudformationproviderHandler.generate(
      { plan: "dp-001" },
      storage,
    );
    expect(step1.variant).toBe("ok");
    expect((step1 as any).stack).toBe(s);
    expect((step1 as any).files).toBe(f);

    // --- THEN clause ---
    // apply(stack: s) -> ok(stack: s, stackId: sid, created: c, updated: u)
    const step2 = await cloudformationproviderHandler.apply(
      { stack: s },
      storage,
    );
    expect(step2.variant).toBe("ok");
    expect((step2 as any).stack).toBe(s);
    expect((step2 as any).stackId).toBe(sid);
    expect((step2 as any).created).toBe(c);
    expect((step2 as any).updated).toBe(u);
  });

});
