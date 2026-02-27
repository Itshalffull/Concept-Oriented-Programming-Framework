// generated: dailynote.conformance.test.ts
import { describe, it, expect } from "vitest";
import { createInMemoryStorage } from "@clef/runtime";
import { dailynoteHandler } from "./dailynote.impl";

describe("DailyNote conformance", () => {

  it("invariant 1: after getOrCreateToday, getOrCreateToday behaves correctly", async () => {
    const storage = createInMemoryStorage();

    let n = "u-test-invariant-001";

    // --- AFTER clause ---
    // getOrCreateToday(note: n) -> ok(note: n, created: true)
    const step1 = await dailynoteHandler.getOrCreateToday(
      { note: n },
      storage,
    );
    expect(step1.variant).toBe("ok");
    n = (step1 as any).note;
    expect((step1 as any).created).toBe(true);

    // --- THEN clause ---
    // getOrCreateToday(note: n) -> ok(note: n, created: false)
    const step2 = await dailynoteHandler.getOrCreateToday(
      { note: n },
      storage,
    );
    expect(step2.variant).toBe("ok");
    n = (step2 as any).note;
    expect((step2 as any).created).toBe(false);
  });

});
