// generated: designtoken.conformance.test.ts
import { describe, it, expect } from "vitest";
import { createInMemoryStorage } from "@copf/runtime";
import { designtokenHandler } from "./designtoken.impl";

describe("DesignToken conformance", () => {

  it("invariant 1: after define, resolve behaves correctly", async () => {
    const storage = createInMemoryStorage();

    const t = "u-test-invariant-001";

    // --- AFTER clause ---
    // define(token: t, name: "blue-500", value: "#3b82f6", type: "color", tier: "primitive") -> ok(token: t)
    const step1 = await designtokenHandler.define(
      { token: t, name: "blue-500", value: "#3b82f6", type: "color", tier: "primitive" },
      storage,
    );
    expect(step1.variant).toBe("ok");
    expect((step1 as any).token).toBe(t);

    // --- THEN clause ---
    // resolve(token: t) -> ok(token: t, resolvedValue: "#3b82f6")
    const step2 = await designtokenHandler.resolve(
      { token: t },
      storage,
    );
    expect(step2.variant).toBe("ok");
    expect((step2 as any).token).toBe(t);
    expect((step2 as any).resolvedValue).toBe("#3b82f6");
  });

});
