// generated: host.conformance.test.ts
import { describe, it, expect } from "vitest";
import { createInMemoryStorage } from "@copf/runtime";
import { hostHandler } from "./host.impl";

describe("Host conformance", () => {

  it("invariant 1: after mount, unmount behaves correctly", async () => {
    const storage = createInMemoryStorage();

    const w = "u-test-invariant-001";

    // --- AFTER clause ---
    // mount(host: w, config: '{ "concept": "urn:app/Article", "view": "list" }')
    //   -> ok(host: w)
    const step1 = await hostHandler.mount(
      { host: w, config: '{ "concept": "urn:app/Article", "view": "list" }' },
      storage,
    );
    expect(step1.variant).toBe("ok");
    expect((step1 as any).host).toBe(w);

    // --- THEN clause ---
    // unmount(host: w) -> ok(host: w)
    const step2 = await hostHandler.unmount(
      { host: w },
      storage,
    );
    expect(step2.variant).toBe("ok");
    expect((step2 as any).host).toBe(w);
  });

  it("setError transitions to error state", async () => {
    const storage = createInMemoryStorage();

    const w = "u-test-error-001";

    await hostHandler.mount(
      { host: w, config: '{ "concept": "urn:app/Todo", "view": "default" }' },
      storage,
    );

    const errorResult = await hostHandler.setError(
      { host: w, errorInfo: "Transport timeout" },
      storage,
    );
    expect(errorResult.variant).toBe("ok");
  });

  it("refresh fails on unmounted host", async () => {
    const storage = createInMemoryStorage();

    const w = "u-test-refresh-001";

    await hostHandler.mount(
      { host: w, config: '{ "concept": "urn:app/Article", "view": "list" }' },
      storage,
    );
    await hostHandler.unmount({ host: w }, storage);

    const refreshResult = await hostHandler.refresh({ host: w }, storage);
    expect(refreshResult.variant).toBe("error");
  });

});
