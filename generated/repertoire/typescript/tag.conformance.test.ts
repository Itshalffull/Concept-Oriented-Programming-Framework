// generated: tag.conformance.test.ts
import { describe, it, expect } from "vitest";
import { createInMemoryStorage } from "@clef/runtime";
import { tagHandler } from "./tag.impl";

describe("Tag conformance", () => {

  it("invariant 1: after addTag, getByTag behaves correctly", async () => {
    const storage = createInMemoryStorage();

    let t = "u-test-invariant-001";

    // --- AFTER clause ---
    // addTag(entity: "page-1", tag: t) -> ok()
    const step1 = await tagHandler.addTag(
      { entity: "page-1", tag: t },
      storage,
    );
    expect(step1.variant).toBe("ok");

    // --- THEN clause ---
    // getByTag(tag: t) -> ok(entities: "page-1")
    const step2 = await tagHandler.getByTag(
      { tag: t },
      storage,
    );
    expect(step2.variant).toBe("ok");
    expect((step2 as any).entities).toBe("page-1");
  });

});
