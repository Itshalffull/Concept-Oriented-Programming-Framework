// generated: session.conformance.test.ts
import { describe, it, expect } from "vitest";
import { createInMemoryStorage } from "@copf/runtime";
import { sessionHandler } from "./session.impl";

describe("Session conformance", () => {

  it("invariant 1: after create, validate behaves correctly", async () => {
    const storage = createInMemoryStorage();

    const s = "u-test-invariant-001";
    const t = "u-test-invariant-002";

    // --- AFTER clause ---
    // create(session: s, userId: "alice", device: "mobile") -> ok(token: t)
    const step1 = await sessionHandler.create(
      { session: s, userId: "alice", device: "mobile" },
      storage,
    );
    expect(step1.variant).toBe("ok");
    expect((step1 as any).token).toBe(t);

    // --- THEN clause ---
    // validate(session: s) -> ok(valid: true)
    const step2 = await sessionHandler.validate(
      { session: s },
      storage,
    );
    expect(step2.variant).toBe("ok");
    expect((step2 as any).valid).toBe(true);
  });

  it("invariant 2: after create, getContext behaves correctly", async () => {
    const storage = createInMemoryStorage();

    const s = "u-test-invariant-001";
    const t = "u-test-invariant-002";

    // --- AFTER clause ---
    // create(session: s, userId: "alice", device: "mobile") -> ok(token: t)
    const step1 = await sessionHandler.create(
      { session: s, userId: "alice", device: "mobile" },
      storage,
    );
    expect(step1.variant).toBe("ok");
    expect((step1 as any).token).toBe(t);

    // --- THEN clause ---
    // getContext(session: s) -> ok(userId: "alice", device: "mobile")
    const step2 = await sessionHandler.getContext(
      { session: s },
      storage,
    );
    expect(step2.variant).toBe("ok");
    expect((step2 as any).userId).toBe("alice");
    expect((step2 as any).device).toBe("mobile");
  });

  it("invariant 3: after create, destroy, validate behaves correctly", async () => {
    const storage = createInMemoryStorage();

    const s = "u-test-invariant-001";
    const t = "u-test-invariant-002";
    const m = "u-test-invariant-003";

    // --- AFTER clause ---
    // create(session: s, userId: "alice", device: "mobile") -> ok(token: t)
    const step1 = await sessionHandler.create(
      { session: s, userId: "alice", device: "mobile" },
      storage,
    );
    expect(step1.variant).toBe("ok");
    expect((step1 as any).token).toBe(t);
    // destroy(session: s) -> ok(session: s)
    const step2 = await sessionHandler.destroy(
      { session: s },
      storage,
    );
    expect(step2.variant).toBe("ok");
    expect((step2 as any).session).toBe(s);

    // --- THEN clause ---
    // validate(session: s) -> notfound(message: m)
    const step3 = await sessionHandler.validate(
      { session: s },
      storage,
    );
    expect(step3.variant).toBe("notfound");
    expect((step3 as any).message).toBe(m);
  });

  it("invariant 4: after create, create, destroyAll, validate behaves correctly", async () => {
    const storage = createInMemoryStorage();

    const s1 = "u-test-invariant-001";
    const t1 = "u-test-invariant-002";
    const s2 = "u-test-invariant-003";
    const t2 = "u-test-invariant-004";
    const m1 = "u-test-invariant-005";

    // --- AFTER clause ---
    // create(session: s1, userId: "alice", device: "mobile") -> ok(token: t1)
    const step1 = await sessionHandler.create(
      { session: s1, userId: "alice", device: "mobile" },
      storage,
    );
    expect(step1.variant).toBe("ok");
    expect((step1 as any).token).toBe(t1);
    // create(session: s2, userId: "alice", device: "desktop") -> ok(token: t2)
    const step2 = await sessionHandler.create(
      { session: s2, userId: "alice", device: "desktop" },
      storage,
    );
    expect(step2.variant).toBe("ok");
    expect((step2 as any).token).toBe(t2);
    // destroyAll(userId: "alice") -> ok(userId: "alice")
    const step3 = await sessionHandler.destroyAll(
      { userId: "alice" },
      storage,
    );
    expect(step3.variant).toBe("ok");
    expect((step3 as any).userId).toBe("alice");

    // --- THEN clause ---
    // validate(session: s1) -> notfound(message: m1)
    const step4 = await sessionHandler.validate(
      { session: s1 },
      storage,
    );
    expect(step4.variant).toBe("notfound");
    expect((step4 as any).message).toBe(m1);
  });

});
