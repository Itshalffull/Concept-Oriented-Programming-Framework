// generated: swifttoolchain.conformance.test.ts
import { describe, it, expect } from "vitest";
import { createInMemoryStorage } from "@copf/runtime";
import { swifttoolchainHandler } from "./swifttoolchain.impl";

describe("SwiftToolchain conformance", () => {

  it("invariant 1: after resolve, register behaves correctly", async () => {
    const storage = createInMemoryStorage();

    const s = "u-test-invariant-001";
    const caps = "u-test-invariant-002";

    // --- AFTER clause ---
    // resolve(target: "linux-arm64", versionConstraint: ">=5.10") -> ok(toolchain: s, compilerPath: "/usr/bin/swiftc", version: "5.10.1", capabilities: ["macros","swift-testing"])
    const step1 = await swifttoolchainHandler.resolve(
      { target: "linux-arm64", versionConstraint: ">=5.10" },
      storage,
    );
    expect(step1.variant).toBe("ok");
    expect((step1 as any).toolchain).toBe(s);
    expect((step1 as any).compilerPath).toBe("/usr/bin/swiftc");
    expect((step1 as any).version).toBe("5.10.1");
    expect((step1 as any).capabilities).toEqual(["macros", "swift-testing"]);

    // --- THEN clause ---
    // register() -> ok(name: "SwiftToolchain", language: "swift", capabilities: caps)
    const step2 = await swifttoolchainHandler.register(
      {},
      storage,
    );
    expect(step2.variant).toBe("ok");
    expect((step2 as any).name).toBe("SwiftToolchain");
    expect((step2 as any).language).toBe("swift");
    expect((step2 as any).capabilities).toBe(caps);
  });

});
