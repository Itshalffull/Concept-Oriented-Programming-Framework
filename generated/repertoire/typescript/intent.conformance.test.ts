// generated: intent.conformance.test.ts
import { describe, it, expect } from "vitest";
import { createInMemoryStorage } from "@clef/runtime";
import { intentHandler } from "./intent.impl";

describe("Intent conformance", () => {

  it("invariant 1: after define, verify behaves correctly", async () => {
    const storage = createInMemoryStorage();

    const i = "u-test-invariant-001";
    const v = "u-test-invariant-002";
    const f = "u-test-invariant-003";

    // --- AFTER clause ---
    // define(intent: i, target: "UserAuth", purpose: "Authenticate users", operationalPrinciple: "After login, session is valid") -> ok(intent: i)
    const step1 = await intentHandler.define(
      { intent: i, target: "UserAuth", purpose: "Authenticate users", operationalPrinciple: "After login, session is valid" },
      storage,
    );
    expect(step1.variant).toBe("ok");
    expect((step1 as any).intent).toBe(i);

    // --- THEN clause ---
    // verify(intent: i) -> ok(valid: v, failures: f)
    const step2 = await intentHandler.verify(
      { intent: i },
      storage,
    );
    expect(step2.variant).toBe("ok");
    expect((step2 as any).valid).toBe(v);
    expect((step2 as any).failures).toBe(f);
  });

});
