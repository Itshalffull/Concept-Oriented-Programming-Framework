// generated: contentstorage.conformance.test.ts
import { describe, it, expect } from "vitest";
import { createInMemoryStorage } from "@clef/runtime";
import { contentstorageHandler } from "./contentstorage.impl";

describe("ContentStorage conformance", () => {

  it("invariant 1: after save, load behaves correctly", async () => {
    const storage = createInMemoryStorage();

    const r = "u-test-invariant-001";

    // --- AFTER clause ---
    // save(record: r, data: "{\"title\":\"Test\"}") -> ok(record: r)
    const step1 = await contentstorageHandler.save(
      { record: r, data: "{\"title\":\"Test\"}" },
      storage,
    );
    expect(step1.variant).toBe("ok");
    expect((step1 as any).record).toBe(r);

    // --- THEN clause ---
    // load(record: r) -> ok(record: r, data: "{\"title\":\"Test\"}")
    const step2 = await contentstorageHandler.load(
      { record: r },
      storage,
    );
    expect(step2.variant).toBe("ok");
    expect((step2 as any).record).toBe(r);
    expect((step2 as any).data).toBe("{\"title\":\"Test\"}");
  });

  it("invariant 2: after save, delete, load behaves correctly", async () => {
    const storage = createInMemoryStorage();

    const r = "u-test-invariant-001";

    // --- AFTER clause ---
    // save(record: r, data: "{\"title\":\"Test\"}") -> ok(record: r)
    const step1 = await contentstorageHandler.save(
      { record: r, data: "{\"title\":\"Test\"}" },
      storage,
    );
    expect(step1.variant).toBe("ok");
    expect((step1 as any).record).toBe(r);
    // delete(record: r) -> ok(record: r)
    const step2 = await contentstorageHandler.delete(
      { record: r },
      storage,
    );
    expect(step2.variant).toBe("ok");
    expect((step2 as any).record).toBe(r);

    // --- THEN clause ---
    // load(record: r) -> notfound(message: "not found")
    const step3 = await contentstorageHandler.load(
      { record: r },
      storage,
    );
    expect(step3.variant).toBe("notfound");
    expect((step3 as any).message).toBe("not found");
  });

});
