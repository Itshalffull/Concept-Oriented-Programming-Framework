// generated: typesystem.conformance.test.ts
import { describe, it, expect } from "vitest";
import { createInMemoryStorage } from "@clef/runtime";
import { typesystemHandler } from "./typesystem.impl";

describe("TypeSystem conformance", () => {

  it("invariant 1: after registerType, resolve behaves correctly", async () => {
    const storage = createInMemoryStorage();

    let t = "u-test-invariant-001";

    // --- AFTER clause ---
    // registerType(type: t, schema: "{\"type\":\"string\"}", constraints: "{}") -> ok(type: t)
    const step1 = await typesystemHandler.registerType(
      { type: t, schema: "{\"type\":\"string\"}", constraints: "{}" },
      storage,
    );
    expect(step1.variant).toBe("ok");
    t = (step1 as any).type;

    // --- THEN clause ---
    // resolve(type: t) -> ok(type: t, schema: "{\"type\":\"string\"}")
    const step2 = await typesystemHandler.resolve(
      { type: t },
      storage,
    );
    expect(step2.variant).toBe("ok");
    t = (step2 as any).type;
    expect((step2 as any).schema).toBe("{\"type\":\"string\"}");
  });

  it("invariant 2: after registerType, registerType behaves correctly", async () => {
    const storage = createInMemoryStorage();

    let t = "u-test-invariant-001";

    // --- AFTER clause ---
    // registerType(type: t, schema: "{\"type\":\"string\"}", constraints: "{}") -> ok(type: t)
    const step1 = await typesystemHandler.registerType(
      { type: t, schema: "{\"type\":\"string\"}", constraints: "{}" },
      storage,
    );
    expect(step1.variant).toBe("ok");
    expect((step1 as any).type).toBe(t);

    // --- THEN clause ---
    // registerType(type: t, schema: "{\"type\":\"number\"}", constraints: "{}") -> exists(message: "already exists")
    const step2 = await typesystemHandler.registerType(
      { type: t, schema: "{\"type\":\"number\"}", constraints: "{}" },
      storage,
    );
    expect(step2.variant).toBe("exists");
    expect((step2 as any).message).toBe("already exists");
  });

});
