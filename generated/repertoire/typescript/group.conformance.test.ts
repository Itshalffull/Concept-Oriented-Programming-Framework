// generated: group.conformance.test.ts
import { describe, it, expect } from "vitest";
import { createInMemoryStorage } from "@clef/runtime";
import { groupHandler } from "./group.impl";

describe("Group conformance", () => {

  it("invariant 1: after createGroup, addMember, checkGroupAccess behaves correctly", async () => {
    const storage = createInMemoryStorage();

    let g = "u-test-invariant-001";
    let n = "u-test-invariant-002";
    let u = "u-test-invariant-003";

    // --- AFTER clause ---
    // createGroup(group: g, name: n) -> ok()
    const step1 = await groupHandler.createGroup(
      { group: g, name: n },
      storage,
    );
    expect(step1.variant).toBe("ok");

    // --- THEN clause ---
    // addMember(group: g, user: u, role: "member") -> ok()
    const step2 = await groupHandler.addMember(
      { group: g, user: u, role: "member" },
      storage,
    );
    expect(step2.variant).toBe("ok");
    // checkGroupAccess(group: g, user: u, permission: "read") -> ok(granted: true)
    const step3 = await groupHandler.checkGroupAccess(
      { group: g, user: u, permission: "read" },
      storage,
    );
    expect(step3.variant).toBe("ok");
    expect((step3 as any).granted).toBe(true);
  });

});
