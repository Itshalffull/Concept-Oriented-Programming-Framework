// generated: namespace.conformance.test.ts
import { describe, it, expect } from "vitest";
import { createInMemoryStorage } from "@copf/runtime";
import { namespaceHandler } from "./namespace.impl";

describe("Namespace conformance", () => {

  it("invariant 1: after createNamespacedPage, getChildren behaves correctly", async () => {
    const storage = createInMemoryStorage();

    const n = "u-test-invariant-001";

    // --- AFTER clause ---
    // createNamespacedPage(node: n, path: "projects/alpha") -> ok()
    const step1 = await namespaceHandler.createNamespacedPage(
      { node: n, path: "projects/alpha" },
      storage,
    );
    expect(step1.variant).toBe("ok");

    // --- THEN clause ---
    // getChildren(node: n) -> ok(children: "")
    const step2 = await namespaceHandler.getChildren(
      { node: n },
      storage,
    );
    expect(step2.variant).toBe("ok");
    expect((step2 as any).children).toBe("");
  });

});
