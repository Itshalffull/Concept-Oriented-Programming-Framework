// generated: env.conformance.test.ts
import { describe, it, expect } from "vitest";
import { createInMemoryStorage } from "@clef/runtime";
import { envHandler } from "./env.impl";

describe("Env conformance", () => {

  it("invariant 1: after resolve, promote behaves correctly", async () => {
    const storage = createInMemoryStorage();

    let e = "u-test-invariant-001";
    let r = "u-test-invariant-002";
    let e2 = "u-test-invariant-003";

    // --- AFTER clause ---
    // resolve(environment: e) -> ok(environment: e, resolved: r)
    const step1 = await envHandler.resolve(
      { environment: e },
      storage,
    );
    expect(step1.variant).toBe("ok");
    e = (step1 as any).environment;
    r = (step1 as any).resolved;

    // --- THEN clause ---
    // promote(fromEnv: e, toEnv: e2, suiteName: "auth") -> ok(toEnv: e2, version: "1.0.0")
    const step2 = await envHandler.promote(
      { fromEnv: e, toEnv: e2, suiteName: "auth" },
      storage,
    );
    expect(step2.variant).toBe("ok");
    e2 = (step2 as any).toEnv;
    expect((step2 as any).version).toBe("1.0.0");
  });

});
