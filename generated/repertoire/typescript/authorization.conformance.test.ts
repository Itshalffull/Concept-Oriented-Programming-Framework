// generated: authorization.conformance.test.ts
import { describe, it, expect } from "vitest";
import { createInMemoryStorage } from "@clef/runtime";
import { authorizationHandler } from "./authorization.impl";

describe("Authorization conformance", () => {

  it("invariant 1: after grantPermission, assignRole, checkPermission behaves correctly", async () => {
    const storage = createInMemoryStorage();

    let x = "u-test-invariant-001";

    // --- AFTER clause ---
    // grantPermission(role: "admin", permission: "write") -> ok(role: "admin", permission: "write")
    const step1 = await authorizationHandler.grantPermission(
      { role: "admin", permission: "write" },
      storage,
    );
    expect(step1.variant).toBe("ok");
    expect((step1 as any).role).toBe("admin");
    expect((step1 as any).permission).toBe("write");
    // assignRole(user: x, role: "admin") -> ok(user: x, role: "admin")
    const step2 = await authorizationHandler.assignRole(
      { user: x, role: "admin" },
      storage,
    );
    expect(step2.variant).toBe("ok");
    x = (step2 as any).user;
    expect((step2 as any).role).toBe("admin");

    // --- THEN clause ---
    // checkPermission(user: x, permission: "write") -> ok(granted: true)
    const step3 = await authorizationHandler.checkPermission(
      { user: x, permission: "write" },
      storage,
    );
    expect(step3.variant).toBe("ok");
    expect((step3 as any).granted).toBe(true);
  });

  it("invariant 2: after grantPermission, assignRole, revokePermission, checkPermission behaves correctly", async () => {
    const storage = createInMemoryStorage();

    let x = "u-test-invariant-001";

    // --- AFTER clause ---
    // grantPermission(role: "editor", permission: "publish") -> ok(role: "editor", permission: "publish")
    const step1 = await authorizationHandler.grantPermission(
      { role: "editor", permission: "publish" },
      storage,
    );
    expect(step1.variant).toBe("ok");
    expect((step1 as any).role).toBe("editor");
    expect((step1 as any).permission).toBe("publish");
    // assignRole(user: x, role: "editor") -> ok(user: x, role: "editor")
    const step2 = await authorizationHandler.assignRole(
      { user: x, role: "editor" },
      storage,
    );
    expect(step2.variant).toBe("ok");
    x = (step2 as any).user;
    expect((step2 as any).role).toBe("editor");
    // revokePermission(role: "editor", permission: "publish") -> ok(role: "editor", permission: "publish")
    const step3 = await authorizationHandler.revokePermission(
      { role: "editor", permission: "publish" },
      storage,
    );
    expect(step3.variant).toBe("ok");
    expect((step3 as any).role).toBe("editor");
    expect((step3 as any).permission).toBe("publish");

    // --- THEN clause ---
    // checkPermission(user: x, permission: "publish") -> ok(granted: false)
    const step4 = await authorizationHandler.checkPermission(
      { user: x, permission: "publish" },
      storage,
    );
    expect(step4.variant).toBe("ok");
    expect((step4 as any).granted).toBe(false);
  });

});
