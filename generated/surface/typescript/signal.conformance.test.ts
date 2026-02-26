// generated: signal.conformance.test.ts
import { describe, it, expect } from "vitest";
import { createInMemoryStorage } from "@clef/runtime";
import { signalHandler } from "./signal.impl";

describe("Signal conformance", () => {

  it("invariant 1: after create, read behaves correctly", async () => {
    const storage = createInMemoryStorage();

    const g = "u-test-invariant-001";

    // --- AFTER clause ---
    // create(signal: g, kind: "state", initialValue: "hello") -> ok(signal: g)
    const step1 = await signalHandler.create(
      { signal: g, kind: "state", initialValue: "hello" },
      storage,
    );
    expect(step1.variant).toBe("ok");
    expect((step1 as any).signal).toBe(g);

    // --- THEN clause ---
    // read(signal: g) -> ok(signal: g, value: "hello", version: _)
    const step2 = await signalHandler.read(
      { signal: g },
      storage,
    );
    expect(step2.variant).toBe("ok");
    expect((step2 as any).signal).toBe(g);
    expect((step2 as any).value).toBe("hello");
    expect((step2 as any).version).toBeDefined();
  });

});
