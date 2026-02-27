// generated: query.conformance.test.ts
import { describe, it, expect } from "vitest";
import { createInMemoryStorage } from "@clef/runtime";
import { queryHandler } from "./query.impl";

describe("Query conformance", () => {

  it("invariant 1: after parse, execute behaves correctly", async () => {
    const storage = createInMemoryStorage();

    let q = "u-test-invariant-001";
    let r = "u-test-invariant-002";

    // --- AFTER clause ---
    // parse(query: q, expression: "status = 'active'") -> ok(query: q)
    const step1 = await queryHandler.parse(
      { query: q, expression: "status = 'active'" },
      storage,
    );
    expect(step1.variant).toBe("ok");
    q = (step1 as any).query;

    // --- THEN clause ---
    // execute(query: q) -> ok(results: r)
    const step2 = await queryHandler.execute(
      { query: q },
      storage,
    );
    expect(step2.variant).toBe("ok");
    r = (step2 as any).results;
  });

});
