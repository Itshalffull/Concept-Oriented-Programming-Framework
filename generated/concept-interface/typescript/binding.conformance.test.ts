// generated: binding.conformance.test.ts
import { describe, it, expect } from "vitest";
import { createInMemoryStorage } from "@copf/runtime";
import { bindingHandler } from "./binding.impl";

describe("Binding conformance", () => {

  it("invariant 1: after bind, sync, bind behaves correctly", async () => {
    const storage = createInMemoryStorage();

    const b = "u-test-invariant-001";
    const c = "u-test-invariant-002";
    const b2 = "u-test-invariant-003";
    const c2 = "u-test-invariant-004";

    // --- AFTER clause ---
    // bind(binding: b, concept: c, mode: "static") -> ok(binding: b)
    const step1 = await bindingHandler.bind(
      { binding: b, concept: c, mode: "static" },
      storage,
    );
    expect(step1.variant).toBe("ok");
    expect((step1 as any).binding).toBe(b);

    // --- THEN clause ---
    // sync(binding: b) -> ok(binding: b)
    const step2 = await bindingHandler.sync(
      { binding: b },
      storage,
    );
    expect(step2.variant).toBe("ok");
    expect((step2 as any).binding).toBe(b);
    // bind(binding: b2, concept: c2, mode: "invalid-mode") -> invalid(message: _)
    const step3 = await bindingHandler.bind(
      { binding: b2, concept: c2, mode: "invalid-mode" },
      storage,
    );
    expect(step3.variant).toBe("invalid");
    expect((step3 as any).message).toBeDefined();
  });

});
