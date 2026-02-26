// generated: dotenvprovider.conformance.test.ts
import { describe, it, expect } from "vitest";
import { createInMemoryStorage } from "@clef/runtime";
import { dotenvproviderHandler } from "./dotenvprovider.impl";

describe("DotenvProvider conformance", () => {

  it("invariant 1: after fetch, fetch behaves correctly", async () => {
    const storage = createInMemoryStorage();

    const v = "u-test-invariant-001";

    // --- AFTER clause ---
    // fetch(name: "DB_HOST", filePath: ".env") -> ok(value: v)
    const step1 = await dotenvproviderHandler.fetch(
      { name: "DB_HOST", filePath: ".env" },
      storage,
    );
    expect(step1.variant).toBe("ok");
    expect((step1 as any).value).toBe(v);

    // --- THEN clause ---
    // fetch(name: "DB_HOST", filePath: ".env") -> ok(value: v)
    const step2 = await dotenvproviderHandler.fetch(
      { name: "DB_HOST", filePath: ".env" },
      storage,
    );
    expect(step2.variant).toBe("ok");
    expect((step2 as any).value).toBe(v);
  });

});
