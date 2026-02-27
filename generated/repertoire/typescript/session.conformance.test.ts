// generated: session.conformance.test.ts
import { describe, it, expect } from "vitest";
import { createInMemoryStorage } from "@clef/runtime";
import { sessionHandler } from "./session.impl";

describe("Session conformance", () => {

  it("invariant 1: after create, validate behaves correctly", async () => {
    const storage = createInMemoryStorage();

    let s = "u-test-invariant-001";
    let t = "u-test-invariant-002";

    // --- AFTER clause ---
    // create(session: s, userId: "alice", device: "mobile") -> ok(token: t)
    const step1 = await sessionHandler.create(
      { session: s, userId: "alice", device: "mobile" },
      storage,
    );
    expect(step1.variant).toBe("ok");
    t = (step1 as any).token;

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

    let s = "u-test-invariant-001";
    let t = "u-test-invariant-002";

    // --- AFTER clause ---
    // create(session: s, userId: "alice", device: "mobile") -> ok(token: t)
    const step1 = await sessionHandler.create(
      { session: s, userId: "alice", device: "mobile" },
      storage,
    );
    expect(step1.variant).toBe("ok");
    t = (step1 as any).token;

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

    let s = "u-test-invariant-001";
    let t = "u-test-invariant-002";
    let m = "u-test-invariant-003";

    // --- AFTER clause ---
    // create(session: s, userId: "alice", device: "mobile") -> ok(token: t)
    const step1 = await sessionHandler.create(
      { session: s, userId: "alice", device: "mobile" },
      storage,
    );
    expect(step1.variant).toBe("ok");
    t = (step1 as any).token;
    // destroy(session: s) -> ok(session: s)
    const step2 = await sessionHandler.destroy(
      { session: s },
      storage,
    );
    expect(step2.variant).toBe("ok");
    s = (step2 as any).session;

    // --- THEN clause ---
    // validate(session: s) -> notfound(message: m)
    const step3 = await sessionHandler.validate(
      { session: s },
      storage,
    );
    expect(step3.variant).toBe("notfound");
    m = (step3 as any).message;
  });

  it("invariant 4: after create, create, destroyAll, validate behaves correctly", async () => {
    const storage = createInMemoryStorage();

    let s1 = "u-test-invariant-001";
    let t1 = "u-test-invariant-002";
    let s2 = "u-test-invariant-003";
    let t2 = "u-test-invariant-004";
    let m1 = "u-test-invariant-005";

    // --- AFTER clause ---
    // create(session: s1, userId: "alice", device: "mobile") -> ok(token: t1)
    const step1 = await sessionHandler.create(
      { session: s1, userId: "alice", device: "mobile" },
      storage,
    );
    expect(step1.variant).toBe("ok");
    t1 = (step1 as any).token;
    // create(session: s2, userId: "alice", device: "desktop") -> ok(token: t2)
    const step2 = await sessionHandler.create(
      { session: s2, userId: "alice", device: "desktop" },
      storage,
    );
    expect(step2.variant).toBe("ok");
    t2 = (step2 as any).token;
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
    m1 = (step4 as any).message;
  });

});
