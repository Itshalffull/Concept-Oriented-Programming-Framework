// generated: dockercomposeruntime.conformance.test.ts
import { describe, it, expect } from "vitest";
import { createInMemoryStorage } from "@copf/runtime";
import { dockercomposeruntimeHandler } from "./dockercomposeruntime.impl";

describe("DockerComposeRuntime conformance", () => {

  it("invariant 1: after provision, deploy behaves correctly", async () => {
    const storage = createInMemoryStorage();

    const p = "u-test-invariant-001";
    const s = "u-test-invariant-002";
    const sn = "u-test-invariant-003";
    const ep = "u-test-invariant-004";
    const cid = "u-test-invariant-005";

    // --- AFTER clause ---
    // provision(concept: "User", composePath: "./docker-compose.yml", ports: p) -> ok(service: s, serviceName: sn, endpoint: ep)
    const step1 = await dockercomposeruntimeHandler.provision(
      { concept: "User", composePath: "./docker-compose.yml", ports: p },
      storage,
    );
    expect(step1.variant).toBe("ok");
    expect((step1 as any).service).toBe(s);
    expect((step1 as any).serviceName).toBe(sn);
    expect((step1 as any).endpoint).toBe(ep);

    // --- THEN clause ---
    // deploy(service: s, imageUri: "user:latest") -> ok(service: s, containerId: cid)
    const step2 = await dockercomposeruntimeHandler.deploy(
      { service: s, imageUri: "user:latest" },
      storage,
    );
    expect(step2.variant).toBe("ok");
    expect((step2 as any).service).toBe(s);
    expect((step2 as any).containerId).toBe(cid);
  });

});
