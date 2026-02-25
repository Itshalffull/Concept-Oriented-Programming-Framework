// generated: builder.conformance.test.ts
import { describe, it, expect } from "vitest";
import { createInMemoryStorage } from "@copf/runtime";
import { builderHandler } from "./builder.impl";

describe("Builder conformance", () => {

  it("invariant 1: after build, status and history behave correctly", async () => {
    const storage = createInMemoryStorage();

    const b = "u-test-invariant-001";
    const bs = "u-test-invariant-002";

    // --- AFTER clause ---
    // build(concept: "password", sourceDir: "./generated/swift/password", language: "swift", target: "linux-arm64", options: {mode:"release"}) -> ok(build: b, hash: "sha256:abc", outputDir: ".copf-artifacts/swift/password", durationMs: 3200)
    const step1 = await builderHandler.build(
      { concept: "password", sourceDir: "./generated/swift/password", language: "swift", target: "linux-arm64", options: { mode: "release" } },
      storage,
    );
    expect(step1.variant).toBe("ok");
    expect((step1 as any).build).toBe(b);
    expect((step1 as any).hash).toBe("sha256:abc");
    expect((step1 as any).outputDir).toBe(".copf-artifacts/swift/password");
    expect((step1 as any).durationMs).toBe(3200);

    // --- THEN clause ---
    // status(build: b) -> ok(build: b, state: "done", durationMs: 3200)
    const step2 = await builderHandler.status(
      { build: b },
      storage,
    );
    expect(step2.variant).toBe("ok");
    expect((step2 as any).build).toBe(b);
    expect((step2 as any).state).toBe("done");
    expect((step2 as any).durationMs).toBe(3200);
    // history(concept: "password", language: "swift") -> ok(builds: bs)
    const step3 = await builderHandler.history(
      { concept: "password", language: "swift" },
      storage,
    );
    expect(step3.variant).toBe("ok");
    expect((step3 as any).builds).toBe(bs);
  });

});
