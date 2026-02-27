// generated: fluxprovider.conformance.test.ts
import { describe, it, expect } from "vitest";
import { createInMemoryStorage } from "@clef/runtime";
import { fluxproviderHandler } from "./fluxprovider.impl";

describe("FluxProvider conformance", () => {

  it("invariant 1: after emit, reconciliationStatus behaves correctly", async () => {
    const storage = createInMemoryStorage();

    let k = "u-test-invariant-001";
    let f = "u-test-invariant-002";
    let rev = "u-test-invariant-003";
    let t = "u-test-invariant-004";

    // --- AFTER clause ---
    // emit(plan: "dp-001", repo: "git@github.com:org/deploy.git", path: "envs/prod") -> ok(kustomization: k, files: f)
    const step1 = await fluxproviderHandler.emit(
      { plan: "dp-001", repo: "git@github.com:org/deploy.git", path: "envs/prod" },
      storage,
    );
    expect(step1.variant).toBe("ok");
    k = (step1 as any).kustomization;
    f = (step1 as any).files;

    // --- THEN clause ---
    // reconciliationStatus(kustomization: k) -> ok(kustomization: k, readyStatus: "True", appliedRevision: rev, reconciledAt: t)
    const step2 = await fluxproviderHandler.reconciliationStatus(
      { kustomization: k },
      storage,
    );
    expect(step2.variant).toBe("ok");
    k = (step2 as any).kustomization;
    expect((step2 as any).readyStatus).toBe("True");
    rev = (step2 as any).appliedRevision;
    t = (step2 as any).reconciledAt;
  });

});
