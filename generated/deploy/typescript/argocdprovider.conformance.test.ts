// generated: argocdprovider.conformance.test.ts
import { describe, it, expect } from "vitest";
import { createInMemoryStorage } from "@clef/runtime";
import { argocdproviderHandler } from "./argocdprovider.impl";

describe("ArgoCDProvider conformance", () => {

  it("invariant 1: after emit, reconciliationStatus behaves correctly", async () => {
    const storage = createInMemoryStorage();

    let a = "u-test-invariant-001";
    let f = "u-test-invariant-002";
    let t = "u-test-invariant-003";

    // --- AFTER clause ---
    // emit(plan: "dp-001", repo: "git@github.com:org/deploy.git", path: "envs/prod") -> ok(application: a, files: f)
    const step1 = await argocdproviderHandler.emit(
      { plan: "dp-001", repo: "git@github.com:org/deploy.git", path: "envs/prod" },
      storage,
    );
    expect(step1.variant).toBe("ok");
    a = (step1 as any).application;
    f = (step1 as any).files;

    // --- THEN clause ---
    // reconciliationStatus(application: a) -> ok(application: a, syncStatus: "Synced", healthStatus: "Healthy", reconciledAt: t)
    const step2 = await argocdproviderHandler.reconciliationStatus(
      { application: a },
      storage,
    );
    expect(step2.variant).toBe("ok");
    a = (step2 as any).application;
    expect((step2 as any).syncStatus).toBe("Synced");
    expect((step2 as any).healthStatus).toBe("Healthy");
    t = (step2 as any).reconciledAt;
  });

});
