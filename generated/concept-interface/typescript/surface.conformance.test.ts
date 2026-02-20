// generated: surface.conformance.test.ts
import { describe, it, expect } from "vitest";
import { createInMemoryStorage } from "@copf/runtime";
import { surfaceHandler } from "./surface.impl";

describe("Surface conformance", () => {

  it("invariant 1: after create, attach, resize behaves correctly", async () => {
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
    // attach(surface: f, renderer: "react-19") -> ok(surface: f)
    const step2 = await surfaceHandler.attach(
      { surface: f, renderer: "react-19" },
      storage,
    );
    expect(step2.variant).toBe("ok");
    expect((step2 as any).surface).toBe(f);
    // resize(surface: f, width: 1024, height: 768) -> ok(surface: f)
    const step3 = await surfaceHandler.resize(
      { surface: f, width: 1024, height: 768 },
      storage,
    );
    expect(step3.variant).toBe("ok");
    expect((step3 as any).surface).toBe(f);
  });

});
