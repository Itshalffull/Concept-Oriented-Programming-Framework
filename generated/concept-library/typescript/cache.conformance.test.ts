// generated: cache.conformance.test.ts
import { describe, it, expect } from "vitest";
import { createInMemoryStorage } from "@copf/runtime";
import { cacheHandler } from "./cache.impl";

describe("Cache conformance", () => {

  it("invariant 1: after set, get behaves correctly", async () => {
    const storage = createInMemoryStorage();

    const b = "u-test-invariant-001";

    // --- AFTER clause ---
    // set(bin: b, key: "k", data: "v", tags: "t1", maxAge: 300) -> ok()
    const step1 = await cacheHandler.set(
      { bin: b, key: "k", data: "v", tags: "t1", maxAge: 300 },
      storage,
    );
    expect(step1.variant).toBe("ok");

    // --- THEN clause ---
    // get(bin: b, key: "k") -> ok(data: "v")
    const step2 = await cacheHandler.get(
      { bin: b, key: "k" },
      storage,
    );
    expect(step2.variant).toBe("ok");
    expect((step2 as any).data).toBe("v");
  });

  it("invariant 2: after set, invalidateByTags, get behaves correctly", async () => {
    const storage = createInMemoryStorage();

    const b = "u-test-invariant-001";

    // --- AFTER clause ---
    // set(bin: b, key: "k", data: "v", tags: "t1", maxAge: 300) -> ok()
    const step1 = await cacheHandler.set(
      { bin: b, key: "k", data: "v", tags: "t1", maxAge: 300 },
      storage,
    );
    expect(step1.variant).toBe("ok");

    // --- THEN clause ---
    // invalidateByTags(tags: "t1") -> ok(count: 1)
    const step2 = await cacheHandler.invalidateByTags(
      { tags: "t1" },
      storage,
    );
    expect(step2.variant).toBe("ok");
    expect((step2 as any).count).toBe(1);
    // get(bin: b, key: "k") -> miss()
    const step3 = await cacheHandler.get(
      { bin: b, key: "k" },
      storage,
    );
    expect(step3.variant).toBe("miss");
  });

});
