// generated: taxonomy.conformance.test.ts
import { describe, it, expect } from "vitest";
import { createInMemoryStorage } from "@clef/runtime";
import { taxonomyHandler } from "./taxonomy.impl";

describe("Taxonomy conformance", () => {

  it("invariant 1: after createVocabulary, addTerm, tagEntity, untagEntity behaves correctly", async () => {
    const storage = createInMemoryStorage();

    const v = "u-test-invariant-001";
    const none = "u-test-invariant-002";

    // --- AFTER clause ---
    // createVocabulary(vocab: v, name: "topics") -> ok()
    const step1 = await taxonomyHandler.createVocabulary(
      { vocab: v, name: "topics" },
      storage,
    );
    expect(step1.variant).toBe("ok");

    // --- THEN clause ---
    // addTerm(vocab: v, term: "science", parent: none) -> ok()
    const step2 = await taxonomyHandler.addTerm(
      { vocab: v, term: "science", parent: none },
      storage,
    );
    expect(step2.variant).toBe("ok");
    // tagEntity(entity: "page-1", vocab: v, term: "science") -> ok()
    const step3 = await taxonomyHandler.tagEntity(
      { entity: "page-1", vocab: v, term: "science" },
      storage,
    );
    expect(step3.variant).toBe("ok");
    // untagEntity(entity: "page-1", vocab: v, term: "science") -> ok()
    const step4 = await taxonomyHandler.untagEntity(
      { entity: "page-1", vocab: v, term: "science" },
      storage,
    );
    expect(step4.variant).toBe("ok");
  });

});
