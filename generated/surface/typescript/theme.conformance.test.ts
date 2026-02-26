// generated: theme.conformance.test.ts
import { describe, it, expect } from "vitest";
import { createInMemoryStorage } from "@clef/runtime";
import { themeHandler } from "./theme.impl";

describe("Theme conformance", () => {

  it("invariant 1: after create, activate, resolve behaves correctly", async () => {
    const storage = createInMemoryStorage();

    const h = "u-test-invariant-001";

    // --- AFTER clause ---
    // create(theme: h, name: "dark", overrides: "{ \"color-bg\": \"#1a1a1a\" }") -> ok(theme: h)
    const step1 = await themeHandler.create(
      { theme: h, name: "dark", overrides: "{ \"color-bg\": \"#1a1a1a\" }" },
      storage,
    );
    expect(step1.variant).toBe("ok");
    expect((step1 as any).theme).toBe(h);

    // --- THEN clause ---
    // activate(theme: h, priority: 1) -> ok(theme: h)
    const step2 = await themeHandler.activate(
      { theme: h, priority: 1 },
      storage,
    );
    expect(step2.variant).toBe("ok");
    expect((step2 as any).theme).toBe(h);
    // resolve(theme: h) -> ok(tokens: _)
    const step3 = await themeHandler.resolve(
      { theme: h },
      storage,
    );
    expect(step3.variant).toBe("ok");
    expect((step3 as any).tokens).toBeDefined();
  });

});
