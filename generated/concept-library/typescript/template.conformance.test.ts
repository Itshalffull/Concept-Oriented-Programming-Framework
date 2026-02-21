// generated: template.conformance.test.ts
import { describe, it, expect } from "vitest";
import { createInMemoryStorage } from "@copf/runtime";
import { templateHandler } from "./template.impl";

describe("Template conformance", () => {

  it("invariant 1: after define, instantiate behaves correctly", async () => {
    const storage = createInMemoryStorage();

    const t = "u-test-invariant-001";

    // --- AFTER clause ---
    // define(template: t, body: "Hello {{name}}", variables: "name") -> ok()
    const step1 = await templateHandler.define(
      { template: t, body: "Hello {{name}}", variables: "name" },
      storage,
    );
    expect(step1.variant).toBe("ok");

    // --- THEN clause ---
    // instantiate(template: t, values: "name=World") -> ok(content: "Hello World")
    const step2 = await templateHandler.instantiate(
      { template: t, values: "name=World" },
      storage,
    );
    expect(step2.variant).toBe("ok");
    expect((step2 as any).content).toBe("Hello World");
  });

});
