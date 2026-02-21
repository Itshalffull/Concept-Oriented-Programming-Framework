// generated: secret.conformance.test.ts
import { describe, it, expect } from "vitest";
import { createInMemoryStorage } from "@copf/runtime";
import { secretHandler } from "./secret.impl";

describe("Secret conformance", () => {

  it("invariant 1: after resolve, exists behaves correctly", async () => {
    const storage = createInMemoryStorage();

    const s = "u-test-invariant-001";

    // --- AFTER clause ---
    // resolve(name: "DB_PASSWORD", provider: "vault") -> ok(secret: s, version: "v1")
    const step1 = await secretHandler.resolve(
      { name: "DB_PASSWORD", provider: "vault" },
      storage,
    );
    expect(step1.variant).toBe("ok");
    expect((step1 as any).secret).toBe(s);
    expect((step1 as any).version).toBe("v1");

    // --- THEN clause ---
    // exists(name: "DB_PASSWORD", provider: "vault") -> ok(name: "DB_PASSWORD", exists: true)
    const step2 = await secretHandler.exists(
      { name: "DB_PASSWORD", provider: "vault" },
      storage,
    );
    expect(step2.variant).toBe("ok");
    expect((step2 as any).name).toBe("DB_PASSWORD");
    expect((step2 as any).exists).toBe(true);
  });

});
