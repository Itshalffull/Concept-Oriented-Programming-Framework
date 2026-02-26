// generated: rustbuilder.conformance.test.ts
import { describe, it, expect } from "vitest";
import { createInMemoryStorage } from "@clef/runtime";
import { rustbuilderHandler } from "./rustbuilder.impl";

describe("RustBuilder conformance", () => {

  it("invariant 1: after build, test behaves correctly", async () => {
    const storage = createInMemoryStorage();

    // --- AFTER clause ---
    // build(source: "./generated/rust/password", toolchainPath: "/usr/local/bin/rustc", platform: "x86_64-linux", config: {mode:"release", features:[]}) -> ok(build: r, artifactPath: "...", artifactHash: "sha256:ghi")
    const step1 = await rustbuilderHandler.build(
      { source: "./generated/rust/password", toolchainPath: "/usr/local/bin/rustc", platform: "x86_64-linux", config: { mode: "release", features: [] } },
      storage,
    );
    expect(step1.variant).toBe("ok");
    expect((step1 as any).build).toBeDefined();
    expect((step1 as any).artifactPath).toBeDefined();
    expect((step1 as any).artifactHash).toBeDefined();

    const buildId = (step1 as any).build;

    // --- THEN clause ---
    // test(build: r, toolchainPath: "/usr/local/bin/rustc") -> ok(passed: ..., failed: 0, skipped: ..., duration: ..., testType: "unit")
    const step2 = await rustbuilderHandler.test(
      { build: buildId, toolchainPath: "/usr/local/bin/rustc" },
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
