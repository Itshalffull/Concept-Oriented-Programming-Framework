// generated: automationrule.conformance.test.ts
import { describe, it, expect } from "vitest";
import { createInMemoryStorage } from "@clef/runtime";
import { automationruleHandler } from "./automationrule.impl";

describe("AutomationRule conformance", () => {

  it("invariant 1: after define, enable, evaluate behaves correctly", async () => {
    const storage = createInMemoryStorage();

    const r = "u-test-invariant-001";

    // --- AFTER clause ---
    // define(rule: r, trigger: "on_save", conditions: "status == draft", actions: "notify_reviewer") -> ok()
    const step1 = await automationruleHandler.define(
      { rule: r, trigger: "on_save", conditions: "status == draft", actions: "notify_reviewer" },
      storage,
    );
    expect(step1.variant).toBe("ok");

    // --- THEN clause ---
    // enable(rule: r) -> ok()
    const step2 = await automationruleHandler.enable(
      { rule: r },
      storage,
    );
    expect(step2.variant).toBe("ok");
    // evaluate(rule: r, event: "on_save") -> ok(matched: true)
    const step3 = await automationruleHandler.evaluate(
      { rule: r, event: "on_save" },
      storage,
    );
    expect(step3.variant).toBe("ok");
    expect((step3 as any).matched).toBe(true);
  });

});
