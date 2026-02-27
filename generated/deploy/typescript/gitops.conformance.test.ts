// generated: gitops.conformance.test.ts
import { describe, it, expect } from "vitest";
import { createInMemoryStorage } from "@clef/runtime";
import { gitopsHandler } from "./gitops.impl";

describe("GitOps conformance", () => {

  it("invariant 1: after emit, reconciliationStatus behaves correctly", async () => {
    const storage = createInMemoryStorage();

    let g = "u-test-invariant-001";
    let f = "u-test-invariant-002";
    let t = "u-test-invariant-003";

    // --- AFTER clause ---
    // emit(plan: "dp-001", controller: "argocd", repo: "git@github.com:org/deploy.git", path: "envs/prod") -> ok(manifest: g, files: f)
    const step1 = await gitopsHandler.emit(
      { plan: "dp-001", controller: "argocd", repo: "git@github.com:org/deploy.git", path: "envs/prod" },
      storage,
    );
    expect(step1.variant).toBe("ok");
    g = (step1 as any).manifest;
    f = (step1 as any).files;

    // --- THEN clause ---
    // reconciliationStatus(manifest: g) -> ok(manifest: g, status: "synced", reconciledAt: t)
    const step2 = await gitopsHandler.reconciliationStatus(
      { manifest: g },
      storage,
    );
    expect(step2.variant).toBe("ok");
    g = (step2 as any).manifest;
    expect((step2 as any).status).toBe("synced");
    t = (step2 as any).reconciledAt;
  });

});
