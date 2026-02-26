// generated: platformadapter.conformance.test.ts
import { describe, it, expect } from "vitest";
import { createInMemoryStorage } from "@clef/runtime";
import { platformadapterHandler } from "./platformadapter.impl";

describe("PlatformAdapter conformance", () => {

  it("invariant 1: after register, mapNavigation behaves correctly", async () => {
    const storage = createInMemoryStorage();

    const d = "u-test-invariant-001";

    // --- AFTER clause ---
    // register(adapter: d, platform: "browser", config: "{}")
    //   -> ok(adapter: d)
    const step1 = await platformadapterHandler.register(
      { adapter: d, platform: "browser", config: "{}" },
      storage,
    );
    expect(step1.variant).toBe("ok");
    expect((step1 as any).adapter).toBe(d);

    // --- THEN clause ---
    // mapNavigation(adapter: d,
    //   transition: '{ "type": "push", "destination": "test" }')
    //   -> ok(adapter: d)
    const step2 = await platformadapterHandler.mapNavigation(
      { adapter: d, transition: '{ "type": "push", "destination": "test" }' },
      storage,
    );
    expect(step2.variant).toBe("ok");
    expect((step2 as any).adapter).toBe(d);
  });

  it("mapZone returns platform-specific zone for browser", async () => {
    const storage = createInMemoryStorage();

    const d = "u-test-zone-001";

    await platformadapterHandler.register(
      { adapter: d, platform: "browser", config: "{}" },
      storage,
    );

    const zoneResult = await platformadapterHandler.mapZone(
      { adapter: d, zone: "primary", role: "navigated" },
      storage,
    );
    expect(zoneResult.variant).toBe("ok");
    expect((zoneResult as any).platformZone).toBeDefined();
  });

  it("handlePlatformEvent maps popstate to back action", async () => {
    const storage = createInMemoryStorage();

    const d = "u-test-event-001";

    await platformadapterHandler.register(
      { adapter: d, platform: "browser", config: "{}" },
      storage,
    );

    const eventResult = await platformadapterHandler.handlePlatformEvent(
      { adapter: d, event: '{ "type": "popstate" }' },
      storage,
    );
    expect(eventResult.variant).toBe("ok");
    expect((eventResult as any).action).toBeDefined();
  });

  it("rejects invalid platform", async () => {
    const storage = createInMemoryStorage();

    const d = "u-test-invalid-001";

    const result = await platformadapterHandler.register(
      { adapter: d, platform: "gameboy", config: "{}" },
      storage,
    );
    expect(result.variant).toBe("conflict");
  });

});
