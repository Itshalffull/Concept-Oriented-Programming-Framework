// generated: vaultprovider.conformance.test.ts
import { describe, it, expect } from "vitest";
import { createInMemoryStorage } from "@clef/runtime";
import { vaultproviderHandler } from "./vaultprovider.impl";

describe("VaultProvider conformance", () => {

  it("invariant 1: after fetch, renewLease behaves correctly", async () => {
    const storage = createInMemoryStorage();

    let v = "u-test-invariant-001";
    let lid = "u-test-invariant-002";

    // --- AFTER clause ---
    // fetch(path: "secret/data/db-password") -> ok(value: v, leaseId: lid, leaseDuration: 3600)
    const step1 = await vaultproviderHandler.fetch(
      { path: "secret/data/db-password" },
      storage,
    );
    expect(step1.variant).toBe("ok");
    v = (step1 as any).value;
    lid = (step1 as any).leaseId;
    expect((step1 as any).leaseDuration).toBe(3600);

    // --- THEN clause ---
    // renewLease(leaseId: lid) -> ok(leaseId: lid, newDuration: 3600)
    const step2 = await vaultproviderHandler.renewLease(
      { leaseId: lid },
      storage,
    );
    expect(step2.variant).toBe("ok");
    lid = (step2 as any).leaseId;
    expect((step2 as any).newDuration).toBe(3600);
  });

});
