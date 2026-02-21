// generated: deployplan.conformance.test.ts
import { describe, it, expect } from "vitest";
import { createInMemoryStorage } from "@copf/runtime";
import { deployplanHandler } from "./deployplan.impl";

describe("DeployPlan conformance", () => {

  it("invariant 1: after plan, validate, execute behaves correctly", async () => {
    const storage = createInMemoryStorage();

    const p = "u-test-invariant-001";
    const g = "u-test-invariant-002";
    const w = "u-test-invariant-003";

    // --- AFTER clause ---
    // plan(manifest: "valid-manifest", environment: "staging") -> ok(plan: p, graph: g, estimatedDuration: 300)
    const step1 = await deployplanHandler.plan(
      { manifest: "valid-manifest", environment: "staging" },
      storage,
    );
    expect(step1.variant).toBe("ok");
    expect((step1 as any).plan).toBe(p);
    expect((step1 as any).graph).toBe(g);
    expect((step1 as any).estimatedDuration).toBe(300);

    // --- THEN clause ---
    // validate(plan: p) -> ok(plan: p, warnings: w)
    const step2 = await deployplanHandler.validate(
      { plan: p },
      storage,
    );
    expect(step2.variant).toBe("ok");
    expect((step2 as any).plan).toBe(p);
    expect((step2 as any).warnings).toBe(w);
    // execute(plan: p) -> ok(plan: p, duration: 120, nodesDeployed: 5)
    const step3 = await deployplanHandler.execute(
      { plan: p },
      storage,
    );
    expect(step3.variant).toBe("ok");
    expect((step3 as any).plan).toBe(p);
    expect((step3 as any).duration).toBe(120);
    expect((step3 as any).nodesDeployed).toBe(5);
  });

});
