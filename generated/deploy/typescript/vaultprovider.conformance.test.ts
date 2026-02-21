// generated: vaultprovider.conformance.test.ts
import { describe, it, expect } from "vitest";
import { createInMemoryStorage } from "@copf/runtime";
import { vaultproviderHandler } from "./vaultprovider.impl";

describe("VaultProvider conformance", () => {

  it("invariant 1: after fetch, renewLease behaves correctly", async () => {
    const storage = createInMemoryStorage();

    const v = "u-test-invariant-001";
    const lid = "u-test-invariant-002";

    // --- AFTER clause ---
    // fetch(path: "secret/data/db-password") -> ok(value: v, leaseId: lid, leaseDuration: 3600)
    const step1 = await vaultproviderHandler.fetch(
      { path: "secret/data/db-password" },
      storage,
    );
    expect(step1.variant).toBe("ok");
    expect((step1 as any).value).toBe(v);
    expect((step1 as any).leaseId).toBe(lid);
    expect((step1 as any).leaseDuration).toBe(3600);

    // --- THEN clause ---
    // renewLease(leaseId: lid) -> ok(leaseId: lid, newDuration: 3600)
    const step2 = await vaultproviderHandler.renewLease(
      { leaseId: lid },
      storage,
    );
    expect(step2.variant).toBe("ok");
    expect((step2 as any).leaseId).toBe(lid);
    expect((step2 as any).newDuration).toBe(3600);
  });

});
