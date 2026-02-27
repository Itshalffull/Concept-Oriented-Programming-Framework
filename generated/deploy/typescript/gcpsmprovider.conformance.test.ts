// generated: gcpsmprovider.conformance.test.ts
import { describe, it, expect } from "vitest";
import { createInMemoryStorage } from "@clef/runtime";
import { gcpsmproviderHandler } from "./gcpsmprovider.impl";

describe("GcpSmProvider conformance", () => {

  it("invariant 1: after fetch, rotate behaves correctly", async () => {
    const storage = createInMemoryStorage();

    let v = "u-test-invariant-001";
    let vid = "u-test-invariant-002";
    let pid = "u-test-invariant-003";
    let nv = "u-test-invariant-004";

    // --- AFTER clause ---
    // fetch(secretId: "db-password", version: "latest") -> ok(value: v, versionId: vid, projectId: pid)
    const step1 = await gcpsmproviderHandler.fetch(
      { secretId: "db-password", version: "latest" },
      storage,
    );
    expect(step1.variant).toBe("ok");
    v = (step1 as any).value;
    vid = (step1 as any).versionId;
    pid = (step1 as any).projectId;

    // --- THEN clause ---
    // rotate(secretId: "db-password") -> ok(secretId: "db-password", newVersionId: nv)
    const step2 = await gcpsmproviderHandler.rotate(
      { secretId: "db-password" },
      storage,
    );
    expect(step2.variant).toBe("ok");
    expect((step2 as any).secretId).toBe("db-password");
    nv = (step2 as any).newVersionId;
  });

});
