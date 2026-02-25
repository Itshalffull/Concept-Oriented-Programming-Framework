// generated: swiftbuilder.conformance.test.ts
import { describe, it, expect } from "vitest";
import { createInMemoryStorage } from "@copf/runtime";
import { swiftbuilderHandler } from "./swiftbuilder.impl";

describe("SwiftBuilder conformance", () => {

  it("invariant 1: after build, test behaves correctly", async () => {
    const storage = createInMemoryStorage();

    const s = "u-test-invariant-001";

    // --- AFTER clause ---
    // build(sourceDir: "./generated/swift/password", compilerPath: "/usr/bin/swiftc", target: "linux-arm64", options: {mode:"release"}) -> ok(artifact: s, outputDir: ".copf-artifacts/swift/password", hash: "sha256:abc")
    const step1 = await swiftbuilderHandler.build(
      { sourceDir: "./generated/swift/password", compilerPath: "/usr/bin/swiftc", target: "linux-arm64", options: { mode: "release" } },
      storage,
    );
    expect(step1.variant).toBe("ok");
    expect((step1 as any).artifact).toBe(s);
    expect((step1 as any).outputDir).toBe(".copf-artifacts/swift/password");
    expect((step1 as any).hash).toBe("sha256:abc");

    // --- THEN clause ---
    // test(artifact: s, compilerPath: "/usr/bin/swiftc") -> ok(passed: 12, failed: 0, skipped: 0, durationMs: 1500)
    const step2 = await swiftbuilderHandler.test(
      { artifact: s, compilerPath: "/usr/bin/swiftc" },
      storage,
    );
    expect(step2.variant).toBe("ok");
    expect((step2 as any).passed).toBe(12);
    expect((step2 as any).failed).toBe(0);
    expect((step2 as any).skipped).toBe(0);
    expect((step2 as any).durationMs).toBe(1500);
  });

});
