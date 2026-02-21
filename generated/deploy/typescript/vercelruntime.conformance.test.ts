// generated: vercelruntime.conformance.test.ts
import { describe, it, expect } from "vitest";
import { createInMemoryStorage } from "@copf/runtime";
import { vercelruntimeHandler } from "./vercelruntime.impl";

describe("VercelRuntime conformance", () => {

  it("invariant 1: after provision, deploy behaves correctly", async () => {
    const storage = createInMemoryStorage();

    const p = "u-test-invariant-001";
    const pid = "u-test-invariant-002";
    const ep = "u-test-invariant-003";
    const did = "u-test-invariant-004";
    const url = "u-test-invariant-005";

    // --- AFTER clause ---
    // provision(concept: "User", teamId: "team-1", framework: "nextjs") -> ok(project: p, projectId: pid, endpoint: ep)
    const step1 = await vercelruntimeHandler.provision(
      { concept: "User", teamId: "team-1", framework: "nextjs" },
      storage,
    );
    expect(step1.variant).toBe("ok");
    expect((step1 as any).project).toBe(p);
    expect((step1 as any).projectId).toBe(pid);
    expect((step1 as any).endpoint).toBe(ep);

    // --- THEN clause ---
    // deploy(project: p, sourceDirectory: "./dist") -> ok(project: p, deploymentId: did, deploymentUrl: url)
    const step2 = await vercelruntimeHandler.deploy(
      { project: p, sourceDirectory: "./dist" },
      storage,
    );
    expect(step2.variant).toBe("ok");
    expect((step2 as any).project).toBe(p);
    expect((step2 as any).deploymentId).toBe(did);
    expect((step2 as any).deploymentUrl).toBe(url);
  });

});
