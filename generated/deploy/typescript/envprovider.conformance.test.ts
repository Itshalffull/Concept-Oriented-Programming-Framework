// generated: envprovider.conformance.test.ts
import { describe, it, expect } from "vitest";
import { createInMemoryStorage } from "@copf/runtime";
import { envproviderHandler } from "./envprovider.impl";

describe("EnvProvider conformance", () => {

  it("invariant 1: after fetch, fetch behaves correctly", async () => {
    const storage = createInMemoryStorage();

    const v = "u-test-invariant-001";

    // --- AFTER clause ---
    // fetch(name: "DATABASE_URL") -> ok(value: v)
    const step1 = await envproviderHandler.fetch(
      { name: "DATABASE_URL" },
      storage,
    );
    expect(step1.variant).toBe("ok");
    expect((step1 as any).value).toBe(v);

    // --- THEN clause ---
    // fetch(name: "DATABASE_URL") -> ok(value: v)
    const step2 = await envproviderHandler.fetch(
      { name: "DATABASE_URL" },
      storage,
    );
    expect(step2.variant).toBe("ok");
    expect((step2 as any).value).toBe(v);
  });

});
