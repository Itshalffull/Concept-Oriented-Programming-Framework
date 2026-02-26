// generated: slot.conformance.test.ts
import { describe, it, expect } from "vitest";
import { createInMemoryStorage } from "@clef/runtime";
import { slotHandler } from "./slot.impl";

describe("Slot conformance", () => {

  it("invariant 1: after define, fill, clear behaves correctly", async () => {
    const storage = createInMemoryStorage();

    const l = "u-test-invariant-001";

    // --- AFTER clause ---
    // define(slot: l, name: "header", component: "card") -> ok(slot: l)
    const step1 = await slotHandler.define(
      { slot: l, name: "header", component: "card" },
      storage,
    );
    expect(step1.variant).toBe("ok");
    expect((step1 as any).slot).toBe(l);

    // --- THEN clause ---
    // fill(slot: l, content: "{ \"type\": \"text\", \"value\": \"Hello\" }") -> ok(slot: l)
    const step2 = await slotHandler.fill(
      { slot: l, content: "{ \"type\": \"text\", \"value\": \"Hello\" }" },
      storage,
    );
    expect(step2.variant).toBe("ok");
    expect((step2 as any).slot).toBe(l);
    // clear(slot: l) -> ok(slot: l)
    const step3 = await slotHandler.clear(
      { slot: l },
      storage,
    );
    expect(step3.variant).toBe("ok");
    expect((step3 as any).slot).toBe(l);
  });

});
