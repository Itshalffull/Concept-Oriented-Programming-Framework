// generated: env.conformance.test.ts
import { describe, it, expect } from "vitest";
import { createInMemoryStorage } from "@copf/runtime";
import { envHandler } from "./env.impl";

describe("Env conformance", () => {

  it("invariant 1: after resolve, promote behaves correctly", async () => {
    const storage = createInMemoryStorage();

    const e = "u-test-invariant-001";
    const r = "u-test-invariant-002";
    const e2 = "u-test-invariant-003";

    // --- AFTER clause ---
    // resolve(environment: e) -> ok(environment: e, resolved: r)
    const step1 = await envHandler.resolve(
      { environment: e },
      storage,
    );
    expect(step1.variant).toBe("ok");
    expect((step1 as any).environment).toBe(e);
    expect((step1 as any).resolved).toBe(r);

    // --- THEN clause ---
    // promote(fromEnv: e, toEnv: e2, kitName: "auth") -> ok(toEnv: e2, version: "1.0.0")
    const step2 = await envHandler.promote(
      { fromEnv: e, toEnv: e2, kitName: "auth" },
      storage,
    );
    expect(step2.variant).toBe("ok");
    expect((step2 as any).toEnv).toBe(e2);
    expect((step2 as any).version).toBe("1.0.0");
  });

});
