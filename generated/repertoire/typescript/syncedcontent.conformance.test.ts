// generated: syncedcontent.conformance.test.ts
import { describe, it, expect } from "vitest";
import { createInMemoryStorage } from "@clef/runtime";
import { syncedcontentHandler } from "./syncedcontent.impl";

describe("SyncedContent conformance", () => {

  it("invariant 1: after createReference, editOriginal behaves correctly", async () => {
    const storage = createInMemoryStorage();

    const r = "u-test-invariant-001";
    const o = "u-test-invariant-002";

    // --- AFTER clause ---
    // createReference(ref: r, original: o) -> ok()
    const step1 = await syncedcontentHandler.createReference(
      { ref: r, original: o },
      storage,
    );
    expect(step1.variant).toBe("ok");

    // --- THEN clause ---
    // editOriginal(original: o, content: "updated") -> ok()
    const step2 = await syncedcontentHandler.editOriginal(
      { original: o, content: "updated" },
      storage,
    );
    expect(step2.variant).toBe("ok");
  });

});
