// generated: gcpsmprovider.conformance.test.ts
import { describe, it, expect } from "vitest";
import { createInMemoryStorage } from "@copf/runtime";
import { gcpsmproviderHandler } from "./gcpsmprovider.impl";

describe("GcpSmProvider conformance", () => {

  it("invariant 1: after fetch, rotate behaves correctly", async () => {
    const storage = createInMemoryStorage();

    const v = "u-test-invariant-001";
    const vid = "u-test-invariant-002";
    const pid = "u-test-invariant-003";
    const nv = "u-test-invariant-004";

    // --- AFTER clause ---
    // fetch(secretId: "db-password", version: "latest") -> ok(value: v, versionId: vid, projectId: pid)
    const step1 = await gcpsmproviderHandler.fetch(
      { secretId: "db-password", version: "latest" },
      storage,
    );
    expect(step1.variant).toBe("ok");
    expect((step1 as any).value).toBe(v);
    expect((step1 as any).versionId).toBe(vid);
    expect((step1 as any).projectId).toBe(pid);

    // --- THEN clause ---
    // rotate(secretId: "db-password") -> ok(secretId: "db-password", newVersionId: nv)
    const step2 = await gcpsmproviderHandler.rotate(
      { secretId: "db-password" },
      storage,
    );
    expect(step2.variant).toBe("ok");
    expect((step2 as any).secretId).toBe("db-password");
    expect((step2 as any).newVersionId).toBe(nv);
  });

});
