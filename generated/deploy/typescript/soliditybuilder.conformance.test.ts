// generated: soliditybuilder.conformance.test.ts
import { describe, it, expect } from "vitest";
import { createInMemoryStorage } from "@copf/runtime";
import { soliditybuilderHandler } from "./soliditybuilder.impl";

describe("SolidityBuilder conformance", () => {

  it("invariant 1: after build, test behaves correctly", async () => {
    const storage = createInMemoryStorage();

    const l = "u-test-invariant-001";

    // --- AFTER clause ---
    // build(sourceDir: "./generated/solidity/password", compilerPath: "/usr/local/bin/solc", target: "evm-shanghai", options: {mode:"release"}) -> ok(artifact: l, outputDir: ".copf-artifacts/solidity/password", hash: "sha256:jkl")
    const step1 = await soliditybuilderHandler.build(
      { sourceDir: "./generated/solidity/password", compilerPath: "/usr/local/bin/solc", target: "evm-shanghai", options: { mode: "release" } },
      storage,
    );
    expect(step1.variant).toBe("ok");
    expect((step1 as any).artifact).toBe(l);
    expect((step1 as any).outputDir).toBe(".copf-artifacts/solidity/password");
    expect((step1 as any).hash).toBe("sha256:jkl");

    // --- THEN clause ---
    // test(artifact: l, compilerPath: "/usr/local/bin/solc") -> ok(passed: 6, failed: 0, skipped: 0, durationMs: 800)
    const step2 = await soliditybuilderHandler.test(
      { artifact: l, compilerPath: "/usr/local/bin/solc" },
      storage,
    );
    expect(step2.variant).toBe("ok");
    expect((step2 as any).passed).toBe(6);
    expect((step2 as any).failed).toBe(0);
    expect((step2 as any).skipped).toBe(0);
    expect((step2 as any).durationMs).toBe(800);
  });

});
