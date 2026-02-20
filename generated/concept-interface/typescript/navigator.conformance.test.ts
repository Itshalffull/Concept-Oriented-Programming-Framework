// generated: navigator.conformance.test.ts
import { describe, it, expect } from "vitest";
import { createInMemoryStorage } from "@copf/runtime";
import { navigatorHandler } from "./navigator.impl";

describe("Navigator conformance", () => {

  it("invariant 1: after register, go resolves correctly", async () => {
    const storage = createInMemoryStorage();

    const n = "u-test-invariant-001";

    // --- AFTER clause ---
    // register(nav: n, destination: "detail",
    //   config: '{ "concept": "Article", "view": "detail" }')
    //   -> ok(nav: n)
    const step1 = await navigatorHandler.register(
      { nav: n, destination: "detail",
        config: '{ "concept": "Article", "view": "detail" }' },
      storage,
    );
    expect(step1.variant).toBe("ok");
    expect((step1 as any).nav).toBe(n);

    // --- THEN clause ---
    // go(nav: n, destination: "detail", params: '{ "id": 123 }')
    //   -> ok(nav: n, resolved: _)
    const step2 = await navigatorHandler.go(
      { nav: n, destination: "detail", params: '{ "id": 123 }' },
      storage,
    );
    expect(step2.variant).toBe("ok");
    expect((step2 as any).nav).toBe(n);
    expect((step2 as any).resolved).toBeDefined();
  });

  it("back pops history after navigation", async () => {
    const storage = createInMemoryStorage();

    const n = "u-test-back-001";

    await navigatorHandler.register(
      { nav: n, destination: "home", config: '{ "concept": "Home" }' },
      storage,
    );
    await navigatorHandler.register(
      { nav: n, destination: "detail", config: '{ "concept": "Detail" }' },
      storage,
    );

    await navigatorHandler.go(
      { nav: n, destination: "home", params: '{}' },
      storage,
    );
    await navigatorHandler.go(
      { nav: n, destination: "detail", params: '{}' },
      storage,
    );

    const backResult = await navigatorHandler.back({ nav: n }, storage);
    expect(backResult.variant).toBe("ok");
  });

  it("guard blocks navigation", async () => {
    const storage = createInMemoryStorage();

    const n = "u-test-guard-001";

    await navigatorHandler.register(
      { nav: n, destination: "admin", config: '{ "concept": "Admin" }' },
      storage,
    );

    await navigatorHandler.addGuard(
      { nav: n, guard: '{ "destination": "admin", "condition": "block" }' },
      storage,
    );

    const goResult = await navigatorHandler.go(
      { nav: n, destination: "admin", params: '{}' },
      storage,
    );
    expect(goResult.variant).toBe("blocked");
  });

});
