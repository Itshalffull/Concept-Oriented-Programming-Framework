// generated: swiftbuilder.conformance.test.ts
import { describe, it, expect } from "vitest";
import { createInMemoryStorage } from "@clef/runtime";
import { swiftbuilderHandler } from "./swiftbuilder.impl";

describe("SwiftBuilder conformance", () => {

  it("invariant 1: after build, test behaves correctly", async () => {
    const storage = createInMemoryStorage();

    // --- AFTER clause ---
    // build(source: "./generated/swift/password", toolchainPath: "/usr/bin/swiftc", platform: "linux-arm64", config: {mode:"release", features:[]}) -> ok(build: s, artifactPath: "...", artifactHash: "sha256:abc")
    const step1 = await swiftbuilderHandler.build(
      { source: "./generated/swift/password", toolchainPath: "/usr/bin/swiftc", platform: "linux-arm64", config: { mode: "release", features: [] } },
      storage,
    );
    expect(step1.variant).toBe("ok");
    expect((step1 as any).build).toBeDefined();
    expect((step1 as any).artifactPath).toBeDefined();
    expect((step1 as any).artifactHash).toBeDefined();

    const buildId = (step1 as any).build;

    // --- THEN clause ---
    // test(build: s, toolchainPath: "/usr/bin/swiftc") -> ok(passed: ..., failed: 0, skipped: ..., duration: ..., testType: "unit")
    const step2 = await swiftbuilderHandler.test(
      { build: buildId, toolchainPath: "/usr/bin/swiftc" },
      storage,
    );
    expect(step2.variant).toBe("ok");
    expect(typeof (step2 as any).passed).toBe("number");
    expect((step2 as any).failed).toBe(0);
    expect(typeof (step2 as any).skipped).toBe("number");
    expect(typeof (step2 as any).duration).toBe("number");
    expect((step2 as any).testType).toBe("unit");
  });

});
