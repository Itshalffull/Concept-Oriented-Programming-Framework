// generated: motion.conformance.test.ts
import { describe, it, expect } from "vitest";
import { createInMemoryStorage } from "@copf/runtime";
import { motionHandler } from "./motion.impl";

describe("Motion conformance", () => {

  it("invariant 1: after defineDuration, defineTransition, defineDuration behaves correctly", async () => {
    const storage = createInMemoryStorage();

    const o = "u-test-invariant-001";
    const o2 = "u-test-invariant-002";
    const o3 = "u-test-invariant-003";

    // --- AFTER clause ---
    // defineDuration(motion: o, name: "normal", ms: 200) -> ok(motion: o)
    const step1 = await motionHandler.defineDuration(
      { motion: o, name: "normal", ms: 200 },
      storage,
    );
    expect(step1.variant).toBe("ok");
    expect((step1 as any).motion).toBe(o);

    // --- THEN clause ---
    // defineTransition(motion: o2, name: "fade", config: "{ \"property\": \"opacity\", \"duration\": \"normal\", \"easing\": \"ease-out\" }") -> ok(motion: o2)
    const step2 = await motionHandler.defineTransition(
      { motion: o2, name: "fade", config: "{ \"property\": \"opacity\", \"duration\": \"normal\", \"easing\": \"ease-out\" }" },
      storage,
    );
    expect(step2.variant).toBe("ok");
    expect((step2 as any).motion).toBe(o2);
    // defineDuration(motion: o3, name: "bad", ms: -1) -> invalid(message: _)
    const step3 = await motionHandler.defineDuration(
      { motion: o3, name: "bad", ms: -1 },
      storage,
    );
    expect(step3.variant).toBe("invalid");
    expect((step3 as any).message).toBeDefined();
  });

});
