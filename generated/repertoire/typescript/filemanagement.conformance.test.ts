// generated: filemanagement.conformance.test.ts
import { describe, it, expect } from "vitest";
import { createInMemoryStorage } from "@clef/runtime";
import { filemanagementHandler } from "./filemanagement.impl";

describe("FileManagement conformance", () => {

  it("invariant 1: after upload, addUsage, removeUsage, garbageCollect behaves correctly", async () => {
    const storage = createInMemoryStorage();

    let f = "u-test-invariant-001";
    let d = "u-test-invariant-002";
    let m = "u-test-invariant-003";
    let e = "u-test-invariant-004";

    // --- AFTER clause ---
    // upload(file: f, data: d, mimeType: m) -> ok(file: f)
    const step1 = await filemanagementHandler.upload(
      { file: f, data: d, mimeType: m },
      storage,
    );
    expect(step1.variant).toBe("ok");
    f = (step1 as any).file;

    // --- THEN clause ---
    // addUsage(file: f, entity: e) -> ok()
    const step2 = await filemanagementHandler.addUsage(
      { file: f, entity: e },
      storage,
    );
    expect(step2.variant).toBe("ok");
    // removeUsage(file: f, entity: e) -> ok()
    const step3 = await filemanagementHandler.removeUsage(
      { file: f, entity: e },
      storage,
    );
    expect(step3.variant).toBe("ok");
    // garbageCollect() -> ok(removed: 1)
    const step4 = await filemanagementHandler.garbageCollect(
      {  },
      storage,
    );
    expect(step4.variant).toBe("ok");
    expect((step4 as any).removed).toBe(1);
  });

});
