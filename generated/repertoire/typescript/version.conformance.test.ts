// generated: version.conformance.test.ts
import { describe, it, expect } from "vitest";
import { createInMemoryStorage } from "@clef/runtime";
import { versionHandler } from "./version.impl";

describe("Version conformance", () => {

  it("invariant 1: after snapshot, listVersions, rollback behaves correctly", async () => {
    const storage = createInMemoryStorage();

    const v1 = "u-test-invariant-001";

    // --- AFTER clause ---
    // snapshot(version: v1, entity: "doc", data: "original", author: "alice") -> ok(version: v1)
    const step1 = await versionHandler.snapshot(
      { version: v1, entity: "doc", data: "original", author: "alice" },
      storage,
    );
    expect(step1.variant).toBe("ok");
    expect((step1 as any).version).toBe(v1);

    // --- THEN clause ---
    // listVersions(entity: "doc") -> ok(versions: "v1")
    const step2 = await versionHandler.listVersions(
      { entity: "doc" },
      storage,
    );
    expect(step2.variant).toBe("ok");
    expect((step2 as any).versions).toBe("v1");
    // rollback(version: v1) -> ok(data: "original")
    const step3 = await versionHandler.rollback(
      { version: v1 },
      storage,
    );
    expect(step3.variant).toBe("ok");
    expect((step3 as any).data).toBe("original");
  });

});
