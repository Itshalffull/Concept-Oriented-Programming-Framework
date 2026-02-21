// generated: gitops.conformance.test.ts
import { describe, it, expect } from "vitest";
import { createInMemoryStorage } from "@copf/runtime";
import { gitopsHandler } from "./gitops.impl";

describe("GitOps conformance", () => {

  it("invariant 1: after emit, reconciliationStatus behaves correctly", async () => {
    const storage = createInMemoryStorage();

    const g = "u-test-invariant-001";
    const f = "u-test-invariant-002";
    const t = "u-test-invariant-003";

    // --- AFTER clause ---
    // emit(plan: "dp-001", controller: "argocd", repo: "git@github.com:org/deploy.git", path: "envs/prod") -> ok(manifest: g, files: f)
    const step1 = await gitopsHandler.emit(
      { plan: "dp-001", controller: "argocd", repo: "git@github.com:org/deploy.git", path: "envs/prod" },
      storage,
    );
    expect(step1.variant).toBe("ok");
    expect((step1 as any).manifest).toBe(g);
    expect((step1 as any).files).toBe(f);

    // --- THEN clause ---
    // reconciliationStatus(manifest: g) -> ok(manifest: g, status: "synced", reconciledAt: t)
    const step2 = await gitopsHandler.reconciliationStatus(
      { manifest: g },
      storage,
    );
    expect(step2.variant).toBe("ok");
    expect((step2 as any).manifest).toBe(g);
    expect((step2 as any).status).toBe("synced");
    expect((step2 as any).reconciledAt).toBe(t);
  });

});
