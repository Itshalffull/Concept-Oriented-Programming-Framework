// generated: anatomy.conformance.test.ts
import { describe, it, expect } from "vitest";
import { createInMemoryStorage } from "@clef/runtime";
import { anatomyHandler } from "./anatomy.impl";

describe("Anatomy conformance", () => {

  it("invariant 1: after define, getParts behaves correctly", async () => {
    const storage = createInMemoryStorage();

    const n = "u-test-invariant-001";

    // --- AFTER clause ---
    // define(anatomy: n, component: "dialog", parts: "[\"root\",\"trigger\",\"content\",\"title\"]", slots: "[\"header\",\"body\",\"footer\"]") -> ok(anatomy: n)
    const step1 = await anatomyHandler.define(
      { anatomy: n, component: "dialog", parts: "[\"root\",\"trigger\",\"content\",\"title\"]", slots: "[\"header\",\"body\",\"footer\"]" },
      storage,
    );
    expect(step1.variant).toBe("ok");
    expect((step1 as any).anatomy).toBe(n);

    // --- THEN clause ---
    // getParts(anatomy: n) -> ok(parts: "[\"root\",\"trigger\",\"content\",\"title\"]")
    const step2 = await anatomyHandler.getParts(
      { anatomy: n },
      storage,
    );
    expect(step2.variant).toBe("ok");
    expect((step2 as any).parts).toBe("[\"root\",\"trigger\",\"content\",\"title\"]");
  });

});
