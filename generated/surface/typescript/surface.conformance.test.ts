// generated: surface.conformance.test.ts
import { describe, it, expect } from "vitest";
import { createInMemoryStorage } from "@clef/runtime";
import { surfaceHandler } from "./surface.impl";

describe("Surface conformance", () => {

  it("invariant 1: after create, destroy behaves correctly", async () => {
    const storage = createInMemoryStorage();

    const f = "u-test-invariant-001";

    // --- AFTER clause ---
    // create(surface: f, kind: "browser-dom", mountPoint: "#app") -> ok(surface: f)
    const step1 = await surfaceHandler.create(
      { surface: f, kind: "browser-dom", mountPoint: "#app" },
      storage,
    );
    expect(step1.variant).toBe("ok");
    expect((step1 as any).surface).toBe(f);

    // --- THEN clause ---
    // destroy(surface: f) -> ok(surface: f)
    const step2 = await surfaceHandler.destroy(
      { surface: f },
      storage,
    );
    expect(step2.variant).toBe("ok");
    expect((step2 as any).surface).toBe(f);
  });

  it("mount and unmount lifecycle", async () => {
    const storage = createInMemoryStorage();

    const f = "u-test-mount-001";

    // Create and attach a renderer
    await surfaceHandler.create(
      { surface: f, kind: "browser-dom", mountPoint: "#app" },
      storage,
    );
    await surfaceHandler.attach(
      { surface: f, renderer: "react-19" },
      storage,
    );

    // Mount a tree
    const mountResult = await surfaceHandler.mount(
      { surface: f, tree: '{"type":"div"}', zone: "primary" },
      storage,
    );
    expect(mountResult.variant).toBe("ok");

    // Unmount from zone
    const unmountResult = await surfaceHandler.unmount(
      { surface: f, zone: "primary" },
      storage,
    );
    expect(unmountResult.variant).toBe("ok");
  });

});
