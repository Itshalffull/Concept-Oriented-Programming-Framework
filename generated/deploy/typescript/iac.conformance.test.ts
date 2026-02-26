// generated: iac.conformance.test.ts
import { describe, it, expect } from "vitest";
import { createInMemoryStorage } from "@clef/runtime";
import { iacHandler } from "./iac.impl";

describe("IaC conformance", () => {

  it("invariant 1: after emit, apply behaves correctly", async () => {
    const storage = createInMemoryStorage();

    const c = "u-test-invariant-001";
    const u = "u-test-invariant-002";
    const d = "u-test-invariant-003";

    // --- AFTER clause ---
    // emit(plan: "dp-001", provider: "pulumi") -> ok(output: "stack-ref", fileCount: 3)
    const step1 = await iacHandler.emit(
      { plan: "dp-001", provider: "pulumi" },
      storage,
    );
    expect(step1.variant).toBe("ok");
    expect((step1 as any).output).toBe("stack-ref");
    expect((step1 as any).fileCount).toBe(3);

    // --- THEN clause ---
    // apply(plan: "dp-001", provider: "pulumi") -> ok(created: c, updated: u, deleted: d)
    const step2 = await iacHandler.apply(
      { plan: "dp-001", provider: "pulumi" },
      storage,
    );
    expect(step2.variant).toBe("ok");
    expect((step2 as any).created).toBe(c);
    expect((step2 as any).updated).toBe(u);
    expect((step2 as any).deleted).toBe(d);
  });

});
