// generated: token.conformance.test.ts
import { describe, it, expect } from "vitest";
import { createInMemoryStorage } from "@clef/runtime";
import { tokenHandler } from "./token.impl";

describe("Token conformance", () => {

  it("invariant 1: after registerProvider, replace behaves correctly", async () => {
    const storage = createInMemoryStorage();

    const t = "u-test-invariant-001";

    // --- AFTER clause ---
    // registerProvider(token: t, provider: "userMailProvider") -> ok()
    const step1 = await tokenHandler.registerProvider(
      { token: t, provider: "userMailProvider" },
      storage,
    );
    expect(step1.variant).toBe("ok");

    // --- THEN clause ---
    // replace(text: "Contact [user:mail]", context: "user") -> ok(result: "Contact user@example.com")
    const step2 = await tokenHandler.replace(
      { text: "Contact [user:mail]", context: "user" },
      storage,
    );
    expect(step2.variant).toBe("ok");
    expect((step2 as any).result).toBe("Contact user@example.com");
  });

});
