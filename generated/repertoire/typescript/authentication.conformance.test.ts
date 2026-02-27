// generated: authentication.conformance.test.ts
import { describe, it, expect } from "vitest";
import { createInMemoryStorage } from "@clef/runtime";
import { authenticationHandler } from "./authentication.impl";

describe("Authentication conformance", () => {

  it("invariant 1: after register, login behaves correctly", async () => {
    const storage = createInMemoryStorage();

    let x = "u-test-invariant-001";
    let t = "u-test-invariant-002";

    // --- AFTER clause ---
    // register(user: x, provider: "local", credentials: "secret123") -> ok(user: x)
    const step1 = await authenticationHandler.register(
      { user: x, provider: "local", credentials: "secret123" },
      storage,
    );
    expect(step1.variant).toBe("ok");
    x = (step1 as any).user;

    // --- THEN clause ---
    // login(user: x, credentials: "secret123") -> ok(token: t)
    const step2 = await authenticationHandler.login(
      { user: x, credentials: "secret123" },
      storage,
    );
    expect(step2.variant).toBe("ok");
    t = (step2 as any).token;
  });

  it("invariant 2: after register, login, authenticate behaves correctly", async () => {
    const storage = createInMemoryStorage();

    let x = "u-test-invariant-001";
    let t = "u-test-invariant-002";

    // --- AFTER clause ---
    // register(user: x, provider: "local", credentials: "secret123") -> ok(user: x)
    const step1 = await authenticationHandler.register(
      { user: x, provider: "local", credentials: "secret123" },
      storage,
    );
    expect(step1.variant).toBe("ok");
    x = (step1 as any).user;
    // login(user: x, credentials: "secret123") -> ok(token: t)
    const step2 = await authenticationHandler.login(
      { user: x, credentials: "secret123" },
      storage,
    );
    expect(step2.variant).toBe("ok");
    expect((step2 as any).token).toBe(t);

    // --- THEN clause ---
    // authenticate(token: t) -> ok(user: x)
    const step3 = await authenticationHandler.authenticate(
      { token: t },
      storage,
    );
    expect(step3.variant).toBe("ok");
    expect((step3 as any).user).toBe(x);
  });

  it("invariant 3: after register, register behaves correctly", async () => {
    const storage = createInMemoryStorage();

    const x = "u-test-invariant-001";
    let m = "u-test-invariant-002";

    // --- AFTER clause ---
    // register(user: x, provider: "local", credentials: "secret123") -> ok(user: x)
    const step1 = await authenticationHandler.register(
      { user: x, provider: "local", credentials: "secret123" },
      storage,
    );
    expect(step1.variant).toBe("ok");
    expect((step1 as any).user).toBe(x);

    // --- THEN clause ---
    // register(user: x, provider: "oauth", credentials: "token456") -> exists(message: m)
    const step2 = await authenticationHandler.register(
      { user: x, provider: "oauth", credentials: "token456" },
      storage,
    );
    expect(step2.variant).toBe("exists");
    m = (step2 as any).message;
  });

  it("invariant 4: after register, resetPassword, login behaves correctly", async () => {
    const storage = createInMemoryStorage();

    const x = "u-test-invariant-001";
    let m = "u-test-invariant-002";

    // --- AFTER clause ---
    // register(user: x, provider: "local", credentials: "secret123") -> ok(user: x)
    const step1 = await authenticationHandler.register(
      { user: x, provider: "local", credentials: "secret123" },
      storage,
    );
    expect(step1.variant).toBe("ok");
    expect((step1 as any).user).toBe(x);
    // resetPassword(user: x, newCredentials: "newpass456") -> ok(user: x)
    const step2 = await authenticationHandler.resetPassword(
      { user: x, newCredentials: "newpass456" },
      storage,
    );
    expect(step2.variant).toBe("ok");
    expect((step2 as any).user).toBe(x);

    // --- THEN clause ---
    // login(user: x, credentials: "secret123") -> invalid(message: m)
    const step3 = await authenticationHandler.login(
      { user: x, credentials: "secret123" },
      storage,
    );
    expect(step3.variant).toBe("invalid");
    expect((step3 as any).message).toBe(m);
  });

});
