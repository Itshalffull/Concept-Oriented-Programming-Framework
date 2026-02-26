// generated: pathauto.conformance.test.ts
import { describe, it, expect } from "vitest";
import { createInMemoryStorage } from "@clef/runtime";
import { pathautoHandler } from "./pathauto.impl";

describe("Pathauto conformance", () => {

  it("invariant 1: after generateAlias, cleanString behaves correctly", async () => {
    const storage = createInMemoryStorage();

    const p = "u-test-invariant-001";
    const a = "u-test-invariant-002";

    // --- AFTER clause ---
    // generateAlias(pattern: p, entity: "My Example Page") -> ok(alias: a)
    const step1 = await pathautoHandler.generateAlias(
      { pattern: p, entity: "My Example Page" },
      storage,
    );
    expect(step1.variant).toBe("ok");
    expect((step1 as any).alias).toBe(a);

    // --- THEN clause ---
    // cleanString(input: "My Example Page") -> ok(cleaned: a)
    const step2 = await pathautoHandler.cleanString(
      { input: "My Example Page" },
      storage,
    );
    expect(step2.variant).toBe("ok");
    expect((step2 as any).cleaned).toBe(a);
  });

});
