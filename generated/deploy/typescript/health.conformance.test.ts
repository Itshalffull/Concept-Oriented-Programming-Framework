// generated: health.conformance.test.ts
import { describe, it, expect } from "vitest";
import { createInMemoryStorage } from "@clef/runtime";
import { healthHandler } from "./health.impl";

describe("Health conformance", () => {

  it("invariant 1: after checkConcept, checkKit behaves correctly", async () => {
    const storage = createInMemoryStorage();

    const h = "u-test-invariant-001";
    const h2 = "u-test-invariant-002";
    const cr = "u-test-invariant-003";
    const sr = "u-test-invariant-004";

    // --- AFTER clause ---
    // checkConcept(concept: "User", runtime: "server") -> ok(check: h, latencyMs: 15)
    const step1 = await healthHandler.checkConcept(
      { concept: "User", runtime: "server" },
      storage,
    );
    expect(step1.variant).toBe("ok");
    expect((step1 as any).check).toBe(h);
    expect((step1 as any).latencyMs).toBe(15);

    // --- THEN clause ---
    // checkKit(kit: "auth", environment: "staging") -> ok(check: h2, conceptResults: cr, syncResults: sr)
    const step2 = await healthHandler.checkKit(
      { kit: "auth", environment: "staging" },
      storage,
    );
    expect(step2.variant).toBe("ok");
    expect((step2 as any).check).toBe(h2);
    expect((step2 as any).conceptResults).toBe(cr);
    expect((step2 as any).syncResults).toBe(sr);
  });

});
