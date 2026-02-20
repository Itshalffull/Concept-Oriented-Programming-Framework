// generated: frameworkadapter.conformance.test.ts
import { describe, it, expect } from "vitest";
import { createInMemoryStorage } from "@copf/runtime";
import { frameworkadapterHandler } from "./frameworkadapter.impl";

describe("FrameworkAdapter conformance", () => {

  it("invariant 1: after register, normalize behaves correctly", async () => {
    const storage = createInMemoryStorage();

    const r = "u-test-invariant-001";

    // --- AFTER clause ---
    // register(renderer: r, framework: "react", version: "19", normalizer: "reactNormalizer", mountFn: "reactMount") -> ok(renderer: r)
    const step1 = await frameworkadapterHandler.register(
      { renderer: r, framework: "react", version: "19", normalizer: "reactNormalizer", mountFn: "reactMount" },
      storage,
    );
    expect(step1.variant).toBe("ok");
    expect((step1 as any).renderer).toBe(r);

    // --- THEN clause ---
    // normalize(renderer: r, props: "{ \"onClick\": \"handler_1\" }") -> ok(normalized: _)
    const step2 = await frameworkadapterHandler.normalize(
      { renderer: r, props: "{ \"onClick\": \"handler_1\" }" },
      storage,
    );
    expect(step2.variant).toBe("ok");
    expect((step2 as any).normalized).toBeDefined();
  });

});
