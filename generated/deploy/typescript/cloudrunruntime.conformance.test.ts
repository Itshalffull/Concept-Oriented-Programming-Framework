// generated: cloudrunruntime.conformance.test.ts
import { describe, it, expect } from "vitest";
import { createInMemoryStorage } from "@copf/runtime";
import { cloudrunruntimeHandler } from "./cloudrunruntime.impl";

describe("CloudRunRuntime conformance", () => {

  it("invariant 1: after provision, deploy behaves correctly", async () => {
    const storage = createInMemoryStorage();

    const s = "u-test-invariant-001";
    const url = "u-test-invariant-002";
    const ep = "u-test-invariant-003";
    const r = "u-test-invariant-004";

    // --- AFTER clause ---
    // provision(concept: "User", projectId: "my-project", region: "us-central1", cpu: 1, memory: 512) -> ok(service: s, serviceUrl: url, endpoint: ep)
    const step1 = await cloudrunruntimeHandler.provision(
      { concept: "User", projectId: "my-project", region: "us-central1", cpu: 1, memory: 512 },
      storage,
    );
    expect(step1.variant).toBe("ok");
    expect((step1 as any).service).toBe(s);
    expect((step1 as any).serviceUrl).toBe(url);
    expect((step1 as any).endpoint).toBe(ep);

    // --- THEN clause ---
    // deploy(service: s, imageUri: "gcr.io/my-project/user:latest") -> ok(service: s, revision: r)
    const step2 = await cloudrunruntimeHandler.deploy(
      { service: s, imageUri: "gcr.io/my-project/user:latest" },
      storage,
    );
    expect(step2.variant).toBe("ok");
    expect((step2 as any).service).toBe(s);
    expect((step2 as any).revision).toBe(r);
  });

});
