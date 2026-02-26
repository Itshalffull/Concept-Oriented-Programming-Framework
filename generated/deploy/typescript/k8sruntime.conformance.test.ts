// generated: k8sruntime.conformance.test.ts
import { describe, it, expect } from "vitest";
import { createInMemoryStorage } from "@clef/runtime";
import { k8sruntimeHandler } from "./k8sruntime.impl";

describe("K8sRuntime conformance", () => {

  it("invariant 1: after provision, deploy behaves correctly", async () => {
    const storage = createInMemoryStorage();

    const d = "u-test-invariant-001";
    const sn = "u-test-invariant-002";
    const ep = "u-test-invariant-003";

    // --- AFTER clause ---
    // provision(concept: "User", namespace: "default", cluster: "prod", replicas: 2) -> ok(deployment: d, serviceName: sn, endpoint: ep)
    const step1 = await k8sruntimeHandler.provision(
      { concept: "User", namespace: "default", cluster: "prod", replicas: 2 },
      storage,
    );
    expect(step1.variant).toBe("ok");
    expect((step1 as any).deployment).toBe(d);
    expect((step1 as any).serviceName).toBe(sn);
    expect((step1 as any).endpoint).toBe(ep);

    // --- THEN clause ---
    // deploy(deployment: d, imageUri: "myregistry/user:latest") -> ok(deployment: d, revision: "1")
    const step2 = await k8sruntimeHandler.deploy(
      { deployment: d, imageUri: "myregistry/user:latest" },
      storage,
    );
    expect(step2.variant).toBe("ok");
    expect((step2 as any).deployment).toBe(d);
    expect((step2 as any).revision).toBe("1");
  });

});
