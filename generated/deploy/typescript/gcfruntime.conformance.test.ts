// generated: gcfruntime.conformance.test.ts
import { describe, it, expect } from "vitest";
import { createInMemoryStorage } from "@clef/runtime";
import { gcfruntimeHandler } from "./gcfruntime.impl";

describe("GcfRuntime conformance", () => {

  it("invariant 1: after provision, deploy behaves correctly", async () => {
    const storage = createInMemoryStorage();

    let f = "u-test-invariant-001";
    let ep = "u-test-invariant-002";

    // --- AFTER clause ---
    // provision(concept: "User", projectId: "my-project", region: "us-central1", runtime: "nodejs20", triggerType: "http") -> ok(function: f, endpoint: ep)
    const step1 = await gcfruntimeHandler.provision(
      { concept: "User", projectId: "my-project", region: "us-central1", runtime: "nodejs20", triggerType: "http" },
      storage,
    );
    expect(step1.variant).toBe("ok");
    f = (step1 as any).function;
    ep = (step1 as any).endpoint;

    // --- THEN clause ---
    // deploy(function: f, sourceArchive: "gs://bucket/user.zip") -> ok(function: f, version: "1")
    const step2 = await gcfruntimeHandler.deploy(
      { function: f, sourceArchive: "gs://bucket/user.zip" },
      storage,
    );
    expect(step2.variant).toBe("ok");
    f = (step2 as any).function;
    expect((step2 as any).version).toBe("1");
  });

});
