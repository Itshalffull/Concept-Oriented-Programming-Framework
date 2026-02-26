// generated: health.conformance.test.ts
import { describe, it, expect } from "vitest";
import { createInMemoryStorage } from "@clef/runtime";
import { healthHandler } from "./health.impl";

describe("Health conformance", () => {

  it("invariant 1: after checkConcept, checkKit behaves correctly", async () => {
    const storage = createInMemoryStorage();

    let h = "u-test-invariant-001";
    let h2 = "u-test-invariant-002";
    let cr = "u-test-invariant-003";
    let sr = "u-test-invariant-004";

    // --- AFTER clause ---
    // checkConcept(concept: "User", runtime: "server") -> ok(check: h, latencyMs: 15)
    const step1 = await healthHandler.checkConcept(
      { concept: "User", runtime: "server" },
      storage,
    );
    expect(step1.variant).toBe("ok");
    h = (step1 as any).check;
    expect((step1 as any).latencyMs).toBe(15);

    // --- THEN clause ---
    // checkKit(kit: "auth", environment: "staging") -> ok(check: h2, conceptResults: cr, syncResults: sr)
    const step2 = await healthHandler.checkKit(
      { kit: "auth", environment: "staging" },
      storage,
    );
    expect(step2.variant).toBe("ok");
    h2 = (step2 as any).check;
    cr = (step2 as any).conceptResults;
    sr = (step2 as any).syncResults;
  });

});
