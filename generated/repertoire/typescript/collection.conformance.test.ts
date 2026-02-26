// generated: collection.conformance.test.ts
import { describe, it, expect } from "vitest";
import { createInMemoryStorage } from "@clef/runtime";
import { collectionHandler } from "./collection.impl";

describe("Collection conformance", () => {

  it("invariant 1: after create, addMember, getMembers behaves correctly", async () => {
    const storage = createInMemoryStorage();

    const c = "u-test-invariant-001";

    // --- AFTER clause ---
    // create(collection: c, type: "list", schema: "default") -> ok()
    const step1 = await collectionHandler.create(
      { collection: c, type: "list", schema: "default" },
      storage,
    );
    expect(step1.variant).toBe("ok");

    // --- THEN clause ---
    // addMember(collection: c, member: "item1") -> ok()
    const step2 = await collectionHandler.addMember(
      { collection: c, member: "item1" },
      storage,
    );
    expect(step2.variant).toBe("ok");
    // getMembers(collection: c) -> ok(members: "item1")
    const step3 = await collectionHandler.getMembers(
      { collection: c },
      storage,
    );
    expect(step3.variant).toBe("ok");
    expect((step3 as any).members).toBe("item1");
  });

});
