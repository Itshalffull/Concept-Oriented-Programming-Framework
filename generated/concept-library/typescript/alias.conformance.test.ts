// generated: alias.conformance.test.ts
import { describe, it, expect } from "vitest";
import { createInMemoryStorage } from "@copf/runtime";
import { aliasHandler } from "./alias.impl";

describe("Alias conformance", () => {

  it("invariant 1: after addAlias, resolve behaves correctly", async () => {
    const storage = createInMemoryStorage();

    const x = "u-test-invariant-001";

    // --- AFTER clause ---
    // addAlias(entity: x, name: "homepage") -> ok(entity: x, name: "homepage")
    const step1 = await aliasHandler.addAlias(
      { entity: x, name: "homepage" },
      storage,
    );
    expect(step1.variant).toBe("ok");
    expect((step1 as any).entity).toBe(x);
    expect((step1 as any).name).toBe("homepage");

    // --- THEN clause ---
    // resolve(name: "homepage") -> ok(entity: x)
    const step2 = await aliasHandler.resolve(
      { name: "homepage" },
      storage,
    );
    expect(step2.variant).toBe("ok");
    expect((step2 as any).entity).toBe(x);
  });

});
