// generated: ecsruntime.conformance.test.ts
import { describe, it, expect } from "vitest";
import { createInMemoryStorage } from "@copf/runtime";
import { ecsruntimeHandler } from "./ecsruntime.impl";

describe("EcsRuntime conformance", () => {

  it("invariant 1: after provision, deploy behaves correctly", async () => {
    const storage = createInMemoryStorage();

    const s = "u-test-invariant-001";
    const arn = "u-test-invariant-002";
    const ep = "u-test-invariant-003";
    const td = "u-test-invariant-004";

    // --- AFTER clause ---
    // provision(concept: "User", cpu: 256, memory: 512, cluster: "prod-cluster") -> ok(service: s, serviceArn: arn, endpoint: ep)
    const step1 = await ecsruntimeHandler.provision(
      { concept: "User", cpu: 256, memory: 512, cluster: "prod-cluster" },
      storage,
    );
    expect(step1.variant).toBe("ok");
    expect((step1 as any).service).toBe(s);
    expect((step1 as any).serviceArn).toBe(arn);
    expect((step1 as any).endpoint).toBe(ep);

    // --- THEN clause ---
    // deploy(service: s, imageUri: "ecr.aws/user:latest") -> ok(service: s, taskDefinition: td)
    const step2 = await ecsruntimeHandler.deploy(
      { service: s, imageUri: "ecr.aws/user:latest" },
      storage,
    );
    expect(step2.variant).toBe("ok");
    expect((step2 as any).service).toBe(s);
    expect((step2 as any).taskDefinition).toBe(td);
  });

});
