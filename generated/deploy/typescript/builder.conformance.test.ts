// generated: builder.conformance.test.ts
import { describe, it, expect } from "vitest";
import { createInMemoryStorage } from "@copf/runtime";
import { builderHandler } from "./builder.impl";

describe("Builder conformance", () => {

  it("invariant 1: after build, status and history behave correctly", async () => {
    const storage = createInMemoryStorage();

    // --- AFTER clause ---
    // build(concept: "password", source: "./generated/swift/password", language: "swift", platform: "linux-arm64", config: {mode:"release"}) -> ok(build: b, artifactHash: "sha256:abc", artifactLocation: ".copf-artifacts/swift/password", duration: 3200)
    const step1 = await builderHandler.build(
      { concept: "password", source: "./generated/swift/password", language: "swift", platform: "linux-arm64", config: { mode: "release" } },
      storage,
    );
    expect(step1.variant).toBe("ok");
    expect((step1 as any).build).toBeDefined();
    expect((step1 as any).artifactHash).toBeDefined();
    expect((step1 as any).artifactLocation).toBeDefined();
    expect(typeof (step1 as any).duration).toBe("number");

    const buildId = (step1 as any).build;

    // --- THEN clause ---
    // status(build: b) -> ok(build: b, status: "completed", duration: ...)
    const step2 = await builderHandler.status(
      { build: buildId },
      storage,
    );
    expect(step2.variant).toBe("ok");
    expect((step2 as any).build).toBe(buildId);
    expect((step2 as any).status).toBe("completed");
    expect(typeof (step2 as any).duration).toBe("number");

    // history(concept: "password", language: "swift") -> ok(builds: [...])
    const step3 = await builderHandler.history(
      { concept: "password", language: "swift" },
      storage,
    );
    expect(step3.variant).toBe("ok");
    const builds = (step3 as any).builds;
    expect(Array.isArray(builds)).toBe(true);
    expect(builds.length).toBeGreaterThanOrEqual(1);
    expect(builds[0].language).toBe("swift");
    expect(builds[0].artifactHash).toBeDefined();
  });

});
