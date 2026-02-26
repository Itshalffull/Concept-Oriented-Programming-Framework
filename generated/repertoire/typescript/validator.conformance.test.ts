// generated: validator.conformance.test.ts
import { describe, it, expect } from "vitest";
import { createInMemoryStorage } from "@clef/runtime";
import { validatorHandler } from "./validator.impl";

describe("Validator conformance", () => {

  it("invariant 1: after registerConstraint, addRule, validate behaves correctly", async () => {
    const storage = createInMemoryStorage();

    const v = "u-test-invariant-001";

    // --- AFTER clause ---
    // registerConstraint(validator: v, constraint: "required") -> ok()
    const step1 = await validatorHandler.registerConstraint(
      { validator: v, constraint: "required" },
      storage,
    );
    expect(step1.variant).toBe("ok");

    // --- THEN clause ---
    // addRule(validator: v, field: "email", rule: "required|email") -> ok()
    const step2 = await validatorHandler.addRule(
      { validator: v, field: "email", rule: "required|email" },
      storage,
    );
    expect(step2.variant).toBe("ok");
    // validate(validator: v, data: "{\"email\":\"\"}") -> ok(valid: false, errors: "email is required")
    const step3 = await validatorHandler.validate(
      { validator: v, data: "{\"email\":\"\"}" },
      storage,
    );
    expect(step3.variant).toBe("ok");
    expect((step3 as any).valid).toBe(false);
    expect((step3 as any).errors).toBe("email is required");
  });

});
