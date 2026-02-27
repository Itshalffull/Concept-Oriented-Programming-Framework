// generated: dockercomposeruntime.conformance.test.ts
import { describe, it, expect } from "vitest";
import { createInMemoryStorage } from "@clef/runtime";
import { dockercomposeruntimeHandler } from "./dockercomposeruntime.impl";

describe("DockerComposeRuntime conformance", () => {

  it("invariant 1: after provision, deploy behaves correctly", async () => {
    const storage = createInMemoryStorage();

    let p = "u-test-invariant-001";
    let s = "u-test-invariant-002";
    let sn = "u-test-invariant-003";
    let ep = "u-test-invariant-004";
    let cid = "u-test-invariant-005";

    // --- AFTER clause ---
    // provision(concept: "User", composePath: "./docker-compose.yml", ports: p) -> ok(service: s, serviceName: sn, endpoint: ep)
    const step1 = await dockercomposeruntimeHandler.provision(
      { concept: "User", composePath: "./docker-compose.yml", ports: p },
      storage,
    );
    expect(step1.variant).toBe("ok");
    s = (step1 as any).service;
    sn = (step1 as any).serviceName;
    ep = (step1 as any).endpoint;

    // --- THEN clause ---
    // deploy(service: s, imageUri: "user:latest") -> ok(service: s, containerId: cid)
    const step2 = await dockercomposeruntimeHandler.deploy(
      { service: s, imageUri: "user:latest" },
      storage,
    );
    expect(step2.variant).toBe("ok");
    s = (step2 as any).service;
    cid = (step2 as any).containerId;
  });

});
