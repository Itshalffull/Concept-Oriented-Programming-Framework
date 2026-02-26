// generated: configsync.conformance.test.ts
import { describe, it, expect } from "vitest";
import { createInMemoryStorage } from "@clef/runtime";
import { configsyncHandler } from "./configsync.impl";

describe("ConfigSync conformance", () => {

  it("invariant 1: after export, import, export behaves correctly", async () => {
    const storage = createInMemoryStorage();

    const c = "u-test-invariant-001";
    const d = "u-test-invariant-002";

    // --- AFTER clause ---
    // export(config: c) -> ok(data: d)
    const step1 = await configsyncHandler.export(
      { config: c },
      storage,
    );
    expect(step1.variant).toBe("ok");
    expect((step1 as any).data).toBe(d);

    // --- THEN clause ---
    // import(config: c, data: d) -> ok()
    const step2 = await configsyncHandler.import(
      { config: c, data: d },
      storage,
    );
    expect(step2.variant).toBe("ok");
    // export(config: c) -> ok(data: d)
    const step3 = await configsyncHandler.export(
      { config: c },
      storage,
    );
    expect(step3.variant).toBe("ok");
    expect((step3 as any).data).toBe(d);
  });

  it("invariant 2: after override, export behaves correctly", async () => {
    const storage = createInMemoryStorage();

    const c = "u-test-invariant-001";
    const d = "u-test-invariant-002";

    // --- AFTER clause ---
    // override(config: c, layer: "production", values: "debug=false") -> ok()
    const step1 = await configsyncHandler.override(
      { config: c, layer: "production", values: "debug=false" },
      storage,
    );
    expect(step1.variant).toBe("ok");

    // --- THEN clause ---
    // export(config: c) -> ok(data: d)
    const step2 = await configsyncHandler.export(
      { config: c },
      storage,
    );
    expect(step2.variant).toBe("ok");
    expect((step2 as any).data).toBe(d);
  });

});
