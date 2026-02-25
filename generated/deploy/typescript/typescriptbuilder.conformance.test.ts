// generated: typescriptbuilder.conformance.test.ts
import { describe, it, expect } from "vitest";
import { createInMemoryStorage } from "@copf/runtime";
import { typescriptbuilderHandler } from "./typescriptbuilder.impl";

describe("TypeScriptBuilder conformance", () => {

  it("invariant 1: after build, test behaves correctly", async () => {
    const storage = createInMemoryStorage();

    // --- AFTER clause ---
    // build(source: "./generated/typescript/password", toolchainPath: "/usr/local/bin/tsc", platform: "node", config: {mode:"release", features:[]}) -> ok(build: n, artifactPath: "...", artifactHash: "sha256:def")
    const step1 = await typescriptbuilderHandler.build(
      { source: "./generated/typescript/password", toolchainPath: "/usr/local/bin/tsc", platform: "node", config: { mode: "release", features: [] } },
      storage,
    );
    expect(step1.variant).toBe("ok");
    expect((step1 as any).build).toBeDefined();
    expect((step1 as any).artifactPath).toBeDefined();
    expect((step1 as any).artifactHash).toBeDefined();

    const buildId = (step1 as any).build;

    // --- THEN clause ---
    // test(build: n, toolchainPath: "/usr/local/bin/tsc") -> ok(passed: ..., failed: 0, skipped: ..., duration: ..., testType: "unit")
    const step2 = await typescriptbuilderHandler.test(
      { build: buildId, toolchainPath: "/usr/local/bin/tsc" },
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
