// generated: component.conformance.test.ts
import { describe, it, expect } from "vitest";
import { createInMemoryStorage } from "@copf/runtime";
import { componentHandler } from "./component.impl";

describe("Component conformance", () => {

  it("invariant 1: after register, place, render behaves correctly", async () => {
    const storage = createInMemoryStorage();

    const c = "u-test-invariant-001";

    // --- AFTER clause ---
    // register(component: c, config: "hero-banner") -> ok()
    const step1 = await componentHandler.register(
      { component: c, config: "hero-banner" },
      storage,
    );
    expect(step1.variant).toBe("ok");

    // --- THEN clause ---
    // place(component: c, region: "header") -> ok()
    const step2 = await componentHandler.place(
      { component: c, region: "header" },
      storage,
    );
    expect(step2.variant).toBe("ok");
    // render(component: c, context: "homepage") -> ok(output: "hero-banner:header:homepage")
    const step3 = await componentHandler.render(
      { component: c, context: "homepage" },
      storage,
    );
    expect(step3.variant).toBe("ok");
    expect((step3 as any).output).toBe("hero-banner:header:homepage");
  });

});
