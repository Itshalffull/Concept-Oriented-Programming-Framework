// generated: awssmprovider.conformance.test.ts
import { describe, it, expect } from "vitest";
import { createInMemoryStorage } from "@clef/runtime";
import { awssmproviderHandler } from "./awssmprovider.impl";

describe("AwsSmProvider conformance", () => {

  it("invariant 1: after fetch, rotate behaves correctly", async () => {
    const storage = createInMemoryStorage();

    const v = "u-test-invariant-001";
    const vid = "u-test-invariant-002";
    const a = "u-test-invariant-003";
    const nv = "u-test-invariant-004";

    // --- AFTER clause ---
    // fetch(secretId: "prod/db-password", versionStage: "AWSCURRENT") -> ok(value: v, versionId: vid, arn: a)
    const step1 = await awssmproviderHandler.fetch(
      { secretId: "prod/db-password", versionStage: "AWSCURRENT" },
      storage,
    );
    expect(step1.variant).toBe("ok");
    expect((step1 as any).value).toBe(v);
    expect((step1 as any).versionId).toBe(vid);
    expect((step1 as any).arn).toBe(a);

    // --- THEN clause ---
    // rotate(secretId: "prod/db-password") -> ok(secretId: "prod/db-password", newVersionId: nv)
    const step2 = await awssmproviderHandler.rotate(
      { secretId: "prod/db-password" },
      storage,
    );
    expect(step2.variant).toBe("ok");
    expect((step2 as any).secretId).toBe("prod/db-password");
    expect((step2 as any).newVersionId).toBe(nv);
  });

});
