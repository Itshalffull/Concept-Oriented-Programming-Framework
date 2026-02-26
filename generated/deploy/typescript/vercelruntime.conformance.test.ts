// generated: vercelruntime.conformance.test.ts
import { describe, it, expect } from "vitest";
import { createInMemoryStorage } from "@clef/runtime";
import { vercelruntimeHandler } from "./vercelruntime.impl";

describe("VercelRuntime conformance", () => {

  it("invariant 1: after provision, deploy behaves correctly", async () => {
    const storage = createInMemoryStorage();

    let p = "u-test-invariant-001";
    let pid = "u-test-invariant-002";
    let ep = "u-test-invariant-003";
    let did = "u-test-invariant-004";
    let url = "u-test-invariant-005";

    // --- AFTER clause ---
    // provision(concept: "User", teamId: "team-1", framework: "nextjs") -> ok(project: p, projectId: pid, endpoint: ep)
    const step1 = await vercelruntimeHandler.provision(
      { concept: "User", teamId: "team-1", framework: "nextjs" },
      storage,
    );
    expect(step1.variant).toBe("ok");
    p = (step1 as any).project;
    pid = (step1 as any).projectId;
    ep = (step1 as any).endpoint;

    // --- THEN clause ---
    // deploy(project: p, sourceDirectory: "./dist") -> ok(project: p, deploymentId: did, deploymentUrl: url)
    const step2 = await vercelruntimeHandler.deploy(
      { project: p, sourceDirectory: "./dist" },
      storage,
    );
    expect(step2.variant).toBe("ok");
    p = (step2 as any).project;
    did = (step2 as any).deploymentId;
    url = (step2 as any).deploymentUrl;
  });

});
