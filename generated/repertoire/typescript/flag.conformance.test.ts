// generated: flag.conformance.test.ts
import { describe, it, expect } from "vitest";
import { createInMemoryStorage } from "@clef/runtime";
import { flagHandler } from "./flag.impl";

describe("Flag conformance", () => {

  it("invariant 1: after flag, isFlagged behaves correctly", async () => {
    const storage = createInMemoryStorage();

    let f = "u-test-invariant-001";
    let t = "u-test-invariant-002";
    let e = "u-test-invariant-003";
    let u = "u-test-invariant-004";

    // --- AFTER clause ---
    // flag(flagging: f, flagType: t, entity: e, user: u) -> ok()
    const step1 = await flagHandler.flag(
      { flagging: f, flagType: t, entity: e, user: u },
      storage,
    );
    expect(step1.variant).toBe("ok");

    // --- THEN clause ---
    // isFlagged(flagType: t, entity: e, user: u) -> ok(flagged: true)
    const step2 = await flagHandler.isFlagged(
      { flagType: t, entity: e, user: u },
      storage,
    );
    expect(step2.variant).toBe("ok");
    expect((step2 as any).flagged).toBe(true);
  });

  it("invariant 2: after flag, unflag, isFlagged behaves correctly", async () => {
    const storage = createInMemoryStorage();

    let f = "u-test-invariant-001";
    let t = "u-test-invariant-002";
    let e = "u-test-invariant-003";
    let u = "u-test-invariant-004";

    // --- AFTER clause ---
    // flag(flagging: f, flagType: t, entity: e, user: u) -> ok()
    const step1 = await flagHandler.flag(
      { flagging: f, flagType: t, entity: e, user: u },
      storage,
    );
    expect(step1.variant).toBe("ok");

    // --- THEN clause ---
    // unflag(flagging: f) -> ok()
    const step2 = await flagHandler.unflag(
      { flagging: f },
      storage,
    );
    expect(step2.variant).toBe("ok");
    // isFlagged(flagType: t, entity: e, user: u) -> ok(flagged: false)
    const step3 = await flagHandler.isFlagged(
      { flagType: t, entity: e, user: u },
      storage,
    );
    expect(step3.variant).toBe("ok");
    expect((step3 as any).flagged).toBe(false);
  });

});
