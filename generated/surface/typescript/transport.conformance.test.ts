// generated: transport.conformance.test.ts
import { describe, it, expect } from "vitest";
import { createInMemoryStorage } from "@clef/runtime";
import { transportHandler } from "./transport.impl";

describe("Transport conformance", () => {

  it("invariant 1: after configure, fetch returns response", async () => {
    const storage = createInMemoryStorage();

    const t = "u-test-invariant-001";

    // --- AFTER clause ---
    // configure(transport: t,
    //   config: '{ "type": "rest", "baseUrl": "http://localhost" }')
    //   -> ok(transport: t)
    const step1 = await transportHandler.configure(
      { transport: t, config: '{ "type": "rest", "baseUrl": "http://localhost" }' },
      storage,
    );
    expect(step1.variant).toBe("ok");
    expect((step1 as any).transport).toBe(t);

    // --- THEN clause ---
    // fetch(transport: t, request: '{ "method": "GET", "path": "/health" }')
    //   -> ok(transport: t, response: _)
    const step2 = await transportHandler.fetch(
      { transport: t, request: '{ "method": "GET", "path": "/health" }' },
      storage,
    );
    expect(step2.variant).toBe("ok");
    expect((step2 as any).transport).toBe(t);
    expect((step2 as any).response).toBeDefined();
  });

  it("subscribe rejects unsupported transport type", async () => {
    const storage = createInMemoryStorage();

    const t = "u-test-sub-001";

    await transportHandler.configure(
      { transport: t, config: '{ "type": "rest", "baseUrl": "http://localhost" }' },
      storage,
    );

    const subResult = await transportHandler.subscribe(
      { transport: t, channel: "updates" },
      storage,
    );
    expect(subResult.variant).toBe("unsupported");
  });

  it("setAuth injects bearer token", async () => {
    const storage = createInMemoryStorage();

    const t = "u-test-auth-001";

    await transportHandler.configure(
      { transport: t, config: '{ "type": "rest", "baseUrl": "http://localhost" }' },
      storage,
    );

    const authResult = await transportHandler.setAuth(
      { transport: t, auth: '{ "bearer": "tok_abc123" }' },
      storage,
    );
    expect(authResult.variant).toBe("ok");
  });

});
