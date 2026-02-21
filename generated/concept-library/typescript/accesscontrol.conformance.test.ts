// generated: accesscontrol.conformance.test.ts
import { describe, it, expect } from "vitest";
import { createInMemoryStorage } from "@copf/runtime";
import { accesscontrolHandler } from "./accesscontrol.impl";

describe("AccessControl conformance", () => {

  it("invariant 1: after check, check, andIf behaves correctly", async () => {
    const storage = createInMemoryStorage();

    const t = "u-test-invariant-001";
    const t2 = "u-test-invariant-002";

    // --- AFTER clause ---
    // check(resource: "document:123", action: "read", context: "user:alice") -> ok(result: "allowed", tags: t, maxAge: 300)
    const step1 = await accesscontrolHandler.check(
      { resource: "document:123", action: "read", context: "user:alice" },
      storage,
    );
    expect(step1.variant).toBe("ok");
    expect((step1 as any).result).toBe("allowed");
    expect((step1 as any).tags).toBe(t);
    expect((step1 as any).maxAge).toBe(300);
    // check(resource: "document:123", action: "delete", context: "user:alice") -> ok(result: "forbidden", tags: t2, maxAge: 60)
    const step2 = await accesscontrolHandler.check(
      { resource: "document:123", action: "delete", context: "user:alice" },
      storage,
    );
    expect(step2.variant).toBe("ok");
    expect((step2 as any).result).toBe("forbidden");
    expect((step2 as any).tags).toBe(t2);
    expect((step2 as any).maxAge).toBe(60);

    // --- THEN clause ---
    // andIf(left: "allowed", right: "forbidden") -> ok(result: "forbidden")
    const step3 = await accesscontrolHandler.andIf(
      { left: "allowed", right: "forbidden" },
      storage,
    );
    expect(step3.variant).toBe("ok");
    expect((step3 as any).result).toBe("forbidden");
  });

  it("invariant 2: after orIf, andIf behaves correctly", async () => {
    const storage = createInMemoryStorage();

    // --- AFTER clause ---
    // orIf(left: "neutral", right: "allowed") -> ok(result: "allowed")
    const step1 = await accesscontrolHandler.orIf(
      { left: "neutral", right: "allowed" },
      storage,
    );
    expect(step1.variant).toBe("ok");
    expect((step1 as any).result).toBe("allowed");

    // --- THEN clause ---
    // andIf(left: "allowed", right: "allowed") -> ok(result: "allowed")
    const step2 = await accesscontrolHandler.andIf(
      { left: "allowed", right: "allowed" },
      storage,
    );
    expect(step2.variant).toBe("ok");
    expect((step2 as any).result).toBe("allowed");
  });

  it("invariant 3: after orIf, andIf behaves correctly", async () => {
    const storage = createInMemoryStorage();

    // --- AFTER clause ---
    // orIf(left: "neutral", right: "neutral") -> ok(result: "neutral")
    const step1 = await accesscontrolHandler.orIf(
      { left: "neutral", right: "neutral" },
      storage,
    );
    expect(step1.variant).toBe("ok");
    expect((step1 as any).result).toBe("neutral");

    // --- THEN clause ---
    // andIf(left: "neutral", right: "neutral") -> ok(result: "neutral")
    const step2 = await accesscontrolHandler.andIf(
      { left: "neutral", right: "neutral" },
      storage,
    );
    expect(step2.variant).toBe("ok");
    expect((step2 as any).result).toBe("neutral");
  });

});
