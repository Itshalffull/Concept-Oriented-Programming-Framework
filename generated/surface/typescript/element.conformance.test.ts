// generated: element.conformance.test.ts
import { describe, it, expect } from "vitest";
import { createInMemoryStorage } from "@clef/runtime";
import { elementHandler } from "./element.impl";

describe("Element conformance", () => {

  it("invariant 1: after create, setConstraints, create behaves correctly", async () => {
    const storage = createInMemoryStorage();

    const e = "u-test-invariant-001";
    const e2 = "u-test-invariant-002";

    // --- AFTER clause ---
    // create(element: e, kind: "input-text", label: "Title", dataType: "String") -> ok(element: e)
    const step1 = await elementHandler.create(
      { element: e, kind: "input-text", label: "Title", dataType: "String" },
      storage,
    );
    expect(step1.variant).toBe("ok");
    expect((step1 as any).element).toBe(e);

    // --- THEN clause ---
    // setConstraints(element: e, constraints: "{ \"maxLength\": 100, \"pattern\": \"^[A-Z]\" }") -> ok(element: e)
    const step2 = await elementHandler.setConstraints(
      { element: e, constraints: "{ \"maxLength\": 100, \"pattern\": \"^[A-Z]\" }" },
      storage,
    );
    expect(step2.variant).toBe("ok");
    expect((step2 as any).element).toBe(e);
    // create(element: e2, kind: "not-a-real-kind", label: "X", dataType: "String") -> invalid(message: _)
    const step3 = await elementHandler.create(
      { element: e2, kind: "not-a-real-kind", label: "X", dataType: "String" },
      storage,
    );
    expect(step3.variant).toBe("invalid");
    expect((step3 as any).message).toBeDefined();
  });

});
