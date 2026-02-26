// generated: winuiadapter.conformance.test.ts
import { describe, it, expect } from "vitest";
import { createInMemoryStorage } from "@clef/runtime";
import { winuiadapterHandler } from "./winuiadapter.impl";

describe("WinUIAdapter conformance", () => {

  it("invariant 1: after normalize, normalize behaves correctly", async () => {
    const storage = createInMemoryStorage();

    const a = "u-test-invariant-001";

    // --- AFTER clause ---
    // normalize(adapter: a, props: "{ \"onclick\": \"handler_1\", \"class\": \"btn\" }") -> ok(adapter: a, normalized: _)
    const step1 = await winuiadapterHandler.normalize(
      { adapter: a, props: "{ \"onclick\": \"handler_1\", \"class\": \"btn\" }" },
      storage,
    );
    expect(step1.variant).toBe("ok");
    expect((step1 as any).adapter).toBe(a);
    expect((step1 as any).normalized).toBeDefined();

    // --- THEN clause ---
    // normalize(adapter: a, props: "") -> error(message: _)
    const step2 = await winuiadapterHandler.normalize(
      { adapter: a, props: "" },
      storage,
    );
    expect(step2.variant).toBe("error");
    expect((step2 as any).message).toBeDefined();
  });

});
