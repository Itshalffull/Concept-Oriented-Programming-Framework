// generated: lambdaruntime.conformance.test.ts
import { describe, it, expect } from "vitest";
import { createInMemoryStorage } from "@clef/runtime";
import { lambdaruntimeHandler } from "./lambdaruntime.impl";

describe("LambdaRuntime conformance", () => {

  it("invariant 1: after provision, deploy behaves correctly", async () => {
    const storage = createInMemoryStorage();

    const f = "u-test-invariant-001";
    const arn = "u-test-invariant-002";
    const ep = "u-test-invariant-003";

    // --- AFTER clause ---
    // provision(concept: "User", memory: 256, timeout: 30, region: "us-east-1") -> ok(function: f, functionArn: arn, endpoint: ep)
    const step1 = await lambdaruntimeHandler.provision(
      { concept: "User", memory: 256, timeout: 30, region: "us-east-1" },
      storage,
    );
    expect(step1.variant).toBe("ok");
    expect((step1 as any).function).toBe(f);
    expect((step1 as any).functionArn).toBe(arn);
    expect((step1 as any).endpoint).toBe(ep);

    // --- THEN clause ---
    // deploy(function: f, artifactLocation: "s3://bucket/user.zip") -> ok(function: f, version: "1")
    const step2 = await lambdaruntimeHandler.deploy(
      { function: f, artifactLocation: "s3://bucket/user.zip" },
      storage,
    );
    expect(step2.variant).toBe("ok");
    expect((step2 as any).function).toBe(f);
    expect((step2 as any).version).toBe("1");
  });

});
