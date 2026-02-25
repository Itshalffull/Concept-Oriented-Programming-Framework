// generated: soliditybuilder.conformance.test.ts
import { describe, it, expect } from "vitest";
import { createInMemoryStorage } from "@copf/runtime";
import { soliditybuilderHandler } from "./soliditybuilder.impl";

describe("SolidityBuilder conformance", () => {

  it("invariant 1: after build, test behaves correctly", async () => {
    const storage = createInMemoryStorage();

    // --- AFTER clause ---
    // build(source: "./generated/solidity/password", toolchainPath: "/usr/local/bin/solc", platform: "shanghai", config: {mode:"release", features:[]}) -> ok(build: l, artifactPath: "...", artifactHash: "sha256:jkl")
    const step1 = await soliditybuilderHandler.build(
      { source: "./generated/solidity/password", toolchainPath: "/usr/local/bin/solc", platform: "shanghai", config: { mode: "release", features: [] } },
      storage,
    );
    expect(step1.variant).toBe("ok");
    expect((step1 as any).build).toBeDefined();
    expect((step1 as any).artifactPath).toBeDefined();
    expect((step1 as any).artifactHash).toBeDefined();

    const buildId = (step1 as any).build;

    // --- THEN clause ---
    // test(build: l, toolchainPath: "/usr/local/bin/solc") -> ok(passed: ..., failed: 0, skipped: ..., duration: ..., testType: "unit")
    const step2 = await soliditybuilderHandler.test(
      { build: buildId, toolchainPath: "/usr/local/bin/solc" },
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
