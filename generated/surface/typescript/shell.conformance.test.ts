// generated: shell.conformance.test.ts
import { describe, it, expect } from "vitest";
import { createInMemoryStorage } from "@clef/runtime";
import { shellHandler } from "./shell.impl";

describe("Shell conformance", () => {

  it("invariant 1: after initialize, destroy behaves correctly", async () => {
    const storage = createInMemoryStorage();

    const s = "u-test-invariant-001";

    // --- AFTER clause ---
    // initialize(shell: s,
    //   config: '{ "zones": [{ "name": "primary", "role": "navigated" }] }')
    //   -> ok(shell: s)
    const step1 = await shellHandler.initialize(
      { shell: s, config: '{ "zones": [{ "name": "primary", "role": "navigated" }] }' },
      storage,
    );
    expect(step1.variant).toBe("ok");
    expect((step1 as any).shell).toBe(s);

    // --- THEN clause ---
    // destroy(shell: s) -> ok(shell: s)
    const step2 = await shellHandler.destroy(
      { shell: s },
      storage,
    );
    expect(step2.variant).toBe("ok");
    expect((step2 as any).shell).toBe(s);
  });

  it("assignHost to navigated zone replaces host", async () => {
    const storage = createInMemoryStorage();

    const s = "u-test-assign-001";

    await shellHandler.initialize(
      { shell: s, config: '{ "zones": [{ "name": "primary", "role": "navigated" }] }' },
      storage,
    );

    const assign1 = await shellHandler.assignHost(
      { shell: s, zone: "primary", host: "host-1" },
      storage,
    );
    expect(assign1.variant).toBe("ok");

    // Navigated zone accepts replacement
    const assign2 = await shellHandler.assignHost(
      { shell: s, zone: "primary", host: "host-2" },
      storage,
    );
    expect(assign2.variant).toBe("ok");
  });

  it("persistent zone rejects second host", async () => {
    const storage = createInMemoryStorage();

    const s = "u-test-persistent-001";

    await shellHandler.initialize(
      { shell: s, config: '{ "zones": [{ "name": "sidebar", "role": "persistent" }] }' },
      storage,
    );

    await shellHandler.assignHost(
      { shell: s, zone: "sidebar", host: "host-1" },
      storage,
    );

    const assign2 = await shellHandler.assignHost(
      { shell: s, zone: "sidebar", host: "host-2" },
      storage,
    );
    expect(assign2.variant).toBe("occupied");
  });

  it("overlay push and pop lifecycle", async () => {
    const storage = createInMemoryStorage();

    const s = "u-test-overlay-001";

    await shellHandler.initialize(
      { shell: s, config: '{ "zones": [{ "name": "primary", "role": "navigated" }] }' },
      storage,
    );

    await shellHandler.pushOverlay(
      { shell: s, overlay: "modal-1", host: "dialog-host" },
      storage,
    );

    const popResult = await shellHandler.popOverlay({ shell: s }, storage);
    expect(popResult.variant).toBe("ok");
    expect((popResult as any).overlay).toBeDefined();
  });

});
