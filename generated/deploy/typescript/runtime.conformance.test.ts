// generated: runtime.conformance.test.ts
import { describe, it, expect } from "vitest";
import { createInMemoryStorage } from "@clef/runtime";
import { runtimeHandler } from "./runtime.impl";

describe("Runtime conformance", () => {

  it("invariant 1: after provision, deploy behaves correctly", async () => {
    const storage = createInMemoryStorage();

    let i = "u-test-invariant-001";

    // --- AFTER clause ---
    // provision(concept: "User", runtimeType: "ecs-fargate", config: "{}") -> ok(instance: i, endpoint: "http://svc:8080")
    const step1 = await runtimeHandler.provision(
      { concept: "User", runtimeType: "ecs-fargate", config: "{}" },
      storage,
    );
    expect(step1.variant).toBe("ok");
    i = (step1 as any).instance;
    expect((step1 as any).endpoint).toBe("http://svc:8080");

    // --- THEN clause ---
    // deploy(instance: i, artifact: "s3://artifacts/user-v1", version: "1.0.0") -> ok(instance: i, endpoint: "http://svc:8080")
    const step2 = await runtimeHandler.deploy(
      { instance: i, artifact: "s3://artifacts/user-v1", version: "1.0.0" },
      storage,
    );
    expect(step2.variant).toBe("ok");
    i = (step2 as any).instance;
    expect((step2 as any).endpoint).toBe("http://svc:8080");
  });

});
