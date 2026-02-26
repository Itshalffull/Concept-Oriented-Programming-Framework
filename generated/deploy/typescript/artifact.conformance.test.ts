// generated: artifact.conformance.test.ts
import { describe, it, expect } from "vitest";
import { createInMemoryStorage } from "@clef/runtime";
import { artifactHandler } from "./artifact.impl";

describe("Artifact conformance", () => {

  it("invariant 1: after build, resolve behaves correctly", async () => {
    const storage = createInMemoryStorage();

    const d = "u-test-invariant-001";
    const a = "u-test-invariant-002";
    const h = "u-test-invariant-003";
    const loc = "u-test-invariant-004";

    // --- AFTER clause ---
    // build(concept: "User", spec: "user.concept", implementation: "user.handler.ts", deps: d) -> ok(artifact: a, hash: h, sizeBytes: 1024)
    const step1 = await artifactHandler.build(
      { concept: "User", spec: "user.concept", implementation: "user.handler.ts", deps: d },
      storage,
    );
    expect(step1.variant).toBe("ok");
    expect((step1 as any).artifact).toBe(a);
    expect((step1 as any).hash).toBe(h);
    expect((step1 as any).sizeBytes).toBe(1024);

    // --- THEN clause ---
    // resolve(hash: h) -> ok(artifact: a, location: loc)
    const step2 = await artifactHandler.resolve(
      { hash: h },
      storage,
    );
    expect(step2.variant).toBe("ok");
    expect((step2 as any).artifact).toBe(a);
    expect((step2 as any).location).toBe(loc);
  });

});
