// generated: rollout.conformance.test.ts
import { describe, it, expect } from "vitest";
import { createInMemoryStorage } from "@clef/runtime";
import { rolloutHandler } from "./rollout.impl";

describe("Rollout conformance", () => {

  it("invariant 1: after begin, advance behaves correctly", async () => {
    const storage = createInMemoryStorage();

    const s = "u-test-invariant-001";
    const r = "u-test-invariant-002";

    // --- AFTER clause ---
    // begin(plan: "dp-001", strategy: "canary", steps: s) -> ok(rollout: r)
    const step1 = await rolloutHandler.begin(
      { plan: "dp-001", strategy: "canary", steps: s },
      storage,
    );
    expect(step1.variant).toBe("ok");
    expect((step1 as any).rollout).toBe(r);

    // --- THEN clause ---
    // advance(rollout: r) -> ok(rollout: r, newWeight: 25, step: 2)
    const step2 = await rolloutHandler.advance(
      { rollout: r },
      storage,
    );
    expect(step2.variant).toBe("ok");
    expect((step2 as any).rollout).toBe(r);
    expect((step2 as any).newWeight).toBe(25);
    expect((step2 as any).step).toBe(2);
  });

});
