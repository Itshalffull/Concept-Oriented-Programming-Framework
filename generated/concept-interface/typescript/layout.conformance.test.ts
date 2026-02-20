// generated: layout.conformance.test.ts
import { describe, it, expect } from "vitest";
import { createInMemoryStorage } from "@copf/runtime";
import { layoutHandler } from "./layout.impl";

describe("Layout conformance", () => {

  it("invariant 1: after create, configure, create behaves correctly", async () => {
    const storage = createInMemoryStorage();

    const y = "u-test-invariant-001";
    const y2 = "u-test-invariant-002";

    // --- AFTER clause ---
    // create(layout: y, name: "main", kind: "sidebar") -> ok(layout: y)
    const step1 = await layoutHandler.create(
      { layout: y, name: "main", kind: "sidebar" },
      storage,
    );
    expect(step1.variant).toBe("ok");
    expect((step1 as any).layout).toBe(y);

    // --- THEN clause ---
    // configure(layout: y, config: "{ \"direction\": \"row\", \"gap\": \"space-4\" }") -> ok(layout: y)
    const step2 = await layoutHandler.configure(
      { layout: y, config: "{ \"direction\": \"row\", \"gap\": \"space-4\" }" },
      storage,
    );
    expect(step2.variant).toBe("ok");
    expect((step2 as any).layout).toBe(y);
    // create(layout: y2, name: "bad", kind: "nonexistent") -> invalid(message: _)
    const step3 = await layoutHandler.create(
      { layout: y2, name: "bad", kind: "nonexistent" },
      storage,
    );
    expect(step3.variant).toBe("invalid");
    expect((step3 as any).message).toBeDefined();
  });

});
