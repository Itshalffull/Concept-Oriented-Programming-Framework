// generated: frameworkadapter.conformance.test.ts
import { describe, it, expect } from "vitest";
import { createInMemoryStorage } from "@copf/runtime";
import { frameworkadapterHandler } from "./frameworkadapter.impl";

describe("FrameworkAdapter conformance", () => {

  it("invariant 1: after register, mount behaves correctly", async () => {
    const storage = createInMemoryStorage();

    const r = "u-test-invariant-001";

    // --- AFTER clause ---
    // register(renderer: r, framework: "react", version: "19") -> ok(renderer: r)
    const step1 = await frameworkadapterHandler.register(
      { renderer: r, framework: "react", version: "19" },
      storage,
    );
    expect(step1.variant).toBe("ok");
    expect((step1 as any).renderer).toBe(r);

    // --- THEN clause ---
    // mount(renderer: r, machine: "dialog-001", target: "#app") -> ok(renderer: r)
    const step2 = await frameworkadapterHandler.mount(
      { renderer: r, machine: "dialog-001", target: "#app" },
      storage,
    );
    expect(step2.variant).toBe("ok");
    expect((step2 as any).renderer).toBe(r);
  });

});
