// generated: schema.conformance.test.ts
import { describe, it, expect } from "vitest";
import { createInMemoryStorage } from "@clef/runtime";
import { schemaHandler } from "./schema.impl";

describe("Schema conformance", () => {

  it("invariant 1: after defineSchema, addField, applyTo behaves correctly", async () => {
    const storage = createInMemoryStorage();

    const s = "u-test-invariant-001";

    // --- AFTER clause ---
    // defineSchema(schema: s, fields: "title,body") -> ok()
    const step1 = await schemaHandler.defineSchema(
      { schema: s, fields: "title,body" },
      storage,
    );
    expect(step1.variant).toBe("ok");

    // --- THEN clause ---
    // addField(schema: s, field: "author") -> ok()
    const step2 = await schemaHandler.addField(
      { schema: s, field: "author" },
      storage,
    );
    expect(step2.variant).toBe("ok");
    // applyTo(entity: "page-1", schema: s) -> ok()
    const step3 = await schemaHandler.applyTo(
      { entity: "page-1", schema: s },
      storage,
    );
    expect(step3.variant).toBe("ok");
  });

});
