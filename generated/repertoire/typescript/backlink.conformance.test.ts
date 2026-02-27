// generated: backlink.conformance.test.ts
import { describe, it, expect } from "vitest";
import { createInMemoryStorage } from "@clef/runtime";
import { backlinkHandler } from "./backlink.impl";

describe("Backlink conformance", () => {

  it("invariant 1: after reindex, getBacklinks behaves correctly", async () => {
    const storage = createInMemoryStorage();

    let n = "u-test-invariant-001";
    let x = "u-test-invariant-002";
    let s = "u-test-invariant-003";

    // --- AFTER clause ---
    // reindex() -> ok(count: n)
    const step1 = await backlinkHandler.reindex(
      {  },
      storage,
    );
    expect(step1.variant).toBe("ok");
    n = (step1 as any).count;

    // --- THEN clause ---
    // getBacklinks(entity: x) -> ok(sources: s)
    const step2 = await backlinkHandler.getBacklinks(
      { entity: x },
      storage,
    );
    expect(step2.variant).toBe("ok");
    s = (step2 as any).sources;
  });

});
