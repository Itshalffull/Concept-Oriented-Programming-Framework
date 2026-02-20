// generated: uischema.conformance.test.ts
import { describe, it, expect } from "vitest";
import { createInMemoryStorage } from "@copf/runtime";
import { uischemaHandler } from "./uischema.impl";

describe("UISchema conformance", () => {

  it("invariant 1: after inspect, getSchema behaves correctly", async () => {
    const storage = createInMemoryStorage();

    const s = "u-test-invariant-001";

    // --- AFTER clause ---
    // inspect(schema: s, conceptSpec: "concept Test [T] { state { name: T -> String } actions { action create(t: T, name: String) { -> ok(t: T) { Create it. } } } }") -> ok(schema: s)
    const step1 = await uischemaHandler.inspect(
      { schema: s, conceptSpec: "concept Test [T] { state { name: T -> String } actions { action create(t: T, name: String) { -> ok(t: T) { Create it. } } } }" },
      storage,
    );
    expect(step1.variant).toBe("ok");
    expect((step1 as any).schema).toBe(s);

    // --- THEN clause ---
    // getSchema(schema: s) -> ok(schema: s, uiSchema: _)
    const step2 = await uischemaHandler.getSchema(
      { schema: s },
      storage,
    );
    expect(step2.variant).toBe("ok");
    expect((step2 as any).schema).toBe(s);
    expect((step2 as any).uiSchema).toBeDefined();
  });

});
