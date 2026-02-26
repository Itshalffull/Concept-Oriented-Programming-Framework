// generated: relation.conformance.test.ts
import { describe, it, expect } from "vitest";
import { createInMemoryStorage } from "@clef/runtime";
import { relationHandler } from "./relation.impl";

describe("Relation conformance", () => {

  it("invariant 1: after defineRelation, link, getRelated behaves correctly", async () => {
    const storage = createInMemoryStorage();

    let r = "u-test-invariant-001";

    // --- AFTER clause ---
    // defineRelation(relation: r, schema: "parent-child") -> ok(relation: r)
    const step1 = await relationHandler.defineRelation(
      { relation: r, schema: "parent-child" },
      storage,
    );
    expect(step1.variant).toBe("ok");
    r = (step1 as any).relation;

    // --- THEN clause ---
    // link(relation: r, source: "alice", target: "bob") -> ok(relation: r, source: "alice", target: "bob")
    const step2 = await relationHandler.link(
      { relation: r, source: "alice", target: "bob" },
      storage,
    );
    expect(step2.variant).toBe("ok");
    r = (step2 as any).relation;
    expect((step2 as any).source).toBe("alice");
    expect((step2 as any).target).toBe("bob");
    // getRelated(relation: r, entity: "alice") -> ok(related: "bob")
    const step3 = await relationHandler.getRelated(
      { relation: r, entity: "alice" },
      storage,
    );
    expect(step3.variant).toBe("ok");
    expect((step3 as any).related).toBe("bob");
  });

});
