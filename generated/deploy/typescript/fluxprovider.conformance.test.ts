// generated: fluxprovider.conformance.test.ts
import { describe, it, expect } from "vitest";
import { createInMemoryStorage } from "@clef/runtime";
import { fluxproviderHandler } from "./fluxprovider.impl";

describe("FluxProvider conformance", () => {

  it("invariant 1: after emit, reconciliationStatus behaves correctly", async () => {
    const storage = createInMemoryStorage();

    const k = "u-test-invariant-001";
    const f = "u-test-invariant-002";
    const rev = "u-test-invariant-003";
    const t = "u-test-invariant-004";

    // --- AFTER clause ---
    // emit(plan: "dp-001", repo: "git@github.com:org/deploy.git", path: "envs/prod") -> ok(kustomization: k, files: f)
    const step1 = await fluxproviderHandler.emit(
      { plan: "dp-001", repo: "git@github.com:org/deploy.git", path: "envs/prod" },
      storage,
    );
    expect(step1.variant).toBe("ok");
    expect((step1 as any).kustomization).toBe(k);
    expect((step1 as any).files).toBe(f);

    // --- THEN clause ---
    // reconciliationStatus(kustomization: k) -> ok(kustomization: k, readyStatus: "True", appliedRevision: rev, reconciledAt: t)
    const step2 = await fluxproviderHandler.reconciliationStatus(
      { kustomization: k },
      storage,
    );
    expect(step2.variant).toBe("ok");
    expect((step2 as any).kustomization).toBe(k);
    expect((step2 as any).readyStatus).toBe("True");
    expect((step2 as any).appliedRevision).toBe(rev);
    expect((step2 as any).reconciledAt).toBe(t);
  });

});
