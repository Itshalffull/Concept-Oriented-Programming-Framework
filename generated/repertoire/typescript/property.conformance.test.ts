// generated: property.conformance.test.ts
import { describe, it, expect } from "vitest";
import { createInMemoryStorage } from "@clef/runtime";
import { propertyHandler } from "./property.impl";

describe("Property conformance", () => {

  it("invariant 1: after set, get behaves correctly", async () => {
    const storage = createInMemoryStorage();

    const e = "u-test-invariant-001";

    // --- AFTER clause ---
    // set(entity: e, key: "title", value: "Hello World") -> ok(entity: e)
    const step1 = await propertyHandler.set(
      { entity: e, key: "title", value: "Hello World" },
      storage,
    );
    expect(step1.variant).toBe("ok");
    expect((step1 as any).entity).toBe(e);

    // --- THEN clause ---
    // get(entity: e, key: "title") -> ok(value: "Hello World")
    const step2 = await propertyHandler.get(
      { entity: e, key: "title" },
      storage,
    );
    expect(step2.variant).toBe("ok");
    expect((step2 as any).value).toBe("Hello World");
  });

  it("invariant 2: after set, delete, get behaves correctly", async () => {
    const storage = createInMemoryStorage();

    const e = "u-test-invariant-001";

    // --- AFTER clause ---
    // set(entity: e, key: "title", value: "Hello") -> ok(entity: e)
    const step1 = await propertyHandler.set(
      { entity: e, key: "title", value: "Hello" },
      storage,
    );
    expect(step1.variant).toBe("ok");
    expect((step1 as any).entity).toBe(e);
    // delete(entity: e, key: "title") -> ok(entity: e)
    const step2 = await propertyHandler.delete(
      { entity: e, key: "title" },
      storage,
    );
    expect(step2.variant).toBe("ok");
    expect((step2 as any).entity).toBe(e);

    // --- THEN clause ---
    // get(entity: e, key: "title") -> notfound(message: "not found")
    const step3 = await propertyHandler.get(
      { entity: e, key: "title" },
      storage,
    );
    expect(step3.variant).toBe("notfound");
    expect((step3 as any).message).toBe("not found");
  });

});
