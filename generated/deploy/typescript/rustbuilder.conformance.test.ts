// generated: rustbuilder.conformance.test.ts
import { describe, it, expect } from "vitest";
import { createInMemoryStorage } from "@copf/runtime";
import { rustbuilderHandler } from "./rustbuilder.impl";

describe("RustBuilder conformance", () => {

  it("invariant 1: after build, test behaves correctly", async () => {
    const storage = createInMemoryStorage();

    const r = "u-test-invariant-001";

    // --- AFTER clause ---
    // build(sourceDir: "./generated/rust/password", compilerPath: "/usr/local/bin/rustc", target: "linux-x86_64", options: {mode:"release"}) -> ok(artifact: r, outputDir: ".copf-artifacts/rust/password", hash: "sha256:ghi")
    const step1 = await rustbuilderHandler.build(
      { sourceDir: "./generated/rust/password", compilerPath: "/usr/local/bin/rustc", target: "linux-x86_64", options: { mode: "release" } },
      storage,
    );
    expect(step1.variant).toBe("ok");
    expect((step1 as any).artifact).toBe(r);
    expect((step1 as any).outputDir).toBe(".copf-artifacts/rust/password");
    expect((step1 as any).hash).toBe("sha256:ghi");

    // --- THEN clause ---
    // test(artifact: r, compilerPath: "/usr/local/bin/rustc") -> ok(passed: 15, failed: 0, skipped: 0, durationMs: 2100)
    const step2 = await rustbuilderHandler.test(
      { artifact: r, compilerPath: "/usr/local/bin/rustc" },
      storage,
    );
    expect(step2.variant).toBe("ok");
    expect((step2 as any).passed).toBe(15);
    expect((step2 as any).failed).toBe(0);
    expect((step2 as any).skipped).toBe(0);
    expect((step2 as any).durationMs).toBe(2100);
  });

});
