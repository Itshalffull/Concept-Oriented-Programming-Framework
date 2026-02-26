// generated: searchindex.conformance.test.ts
import { describe, it, expect } from "vitest";
import { createInMemoryStorage } from "@clef/runtime";
import { searchindexHandler } from "./searchindex.impl";

describe("SearchIndex conformance", () => {

  it("invariant 1: after createIndex, indexItem, search behaves correctly", async () => {
    const storage = createInMemoryStorage();

    const i = "u-test-invariant-001";
    const r = "u-test-invariant-002";

    // --- AFTER clause ---
    // createIndex(index: i, config: "{}") -> ok(index: i)
    const step1 = await searchindexHandler.createIndex(
      { index: i, config: "{}" },
      storage,
    );
    expect(step1.variant).toBe("ok");
    expect((step1 as any).index).toBe(i);

    // --- THEN clause ---
    // indexItem(index: i, item: "doc-1", data: "hello world") -> ok(index: i)
    const step2 = await searchindexHandler.indexItem(
      { index: i, item: "doc-1", data: "hello world" },
      storage,
    );
    expect(step2.variant).toBe("ok");
    expect((step2 as any).index).toBe(i);
    // search(index: i, query: "hello") -> ok(results: r)
    const step3 = await searchindexHandler.search(
      { index: i, query: "hello" },
      storage,
    );
    expect(step3.variant).toBe("ok");
    expect((step3 as any).results).toBe(r);
  });

});
