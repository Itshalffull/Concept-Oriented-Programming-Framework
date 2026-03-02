// generated: slotprovider.conformance.test.ts
import { describe, it, expect } from "vitest";
import { createInMemoryStorage } from "@clef/runtime";
import { slotproviderHandler } from "./slotprovider.impl";

describe("SlotProvider conformance", () => {

  it("invariant 1: initialize is idempotent and returns consistent pluginRef", async () => {
    const storage = createInMemoryStorage();

    const first = await slotproviderHandler.initialize(
      { config: {} },
      storage,
    );
    expect(first.variant).toBe("ok");
    expect((first as any).pluginRef).toBe("surface-provider:slot");

    const second = await slotproviderHandler.initialize(
      { config: {} },
      storage,
    );
    expect(second.variant).toBe("ok");
    expect((second as any).provider).toBe((first as any).provider);
    expect((second as any).pluginRef).toBe((first as any).pluginRef);
  });

  it("invariant 2: initialize with invalid config returns configError", async () => {
    const storage = createInMemoryStorage();

    const result = await slotproviderHandler.initialize(
      { config: null as any },
      storage,
    );
    expect(result.variant).toBe("configError");
    expect((result as any).message).toBeTruthy();
  });

  it("invariant 3: after define and fill, clear resets the slot to empty", async () => {
    const storage = createInMemoryStorage();

    await slotproviderHandler.initialize({ config: {} }, storage);

    await slotproviderHandler.define(
      { slotId: "s1", name: "header", accepts: ["text", "html"], required: false },
      storage,
    );

    await slotproviderHandler.fill(
      { slotId: "s1", contentId: "c1", contentType: "text", content: "Hello" },
      storage,
    );

    const clearResult = await slotproviderHandler.clear(
      { slotId: "s1" },
      storage,
    );
    expect(clearResult.variant).toBe("ok");

    const slotsResult = await slotproviderHandler.getSlots({}, storage);
    const slot = (slotsResult as any).slots.find((s: any) => s.slotId === "s1");
    expect(slot.filled).toBe(false);
    expect(slot.contentType).toBeNull();
  });

});
