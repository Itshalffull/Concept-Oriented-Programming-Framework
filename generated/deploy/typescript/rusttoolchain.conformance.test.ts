// generated: rusttoolchain.conformance.test.ts
import { describe, it, expect } from "vitest";
import { createInMemoryStorage } from "@copf/runtime";
import { rusttoolchainHandler } from "./rusttoolchain.impl";

describe("RustToolchain conformance", () => {

  it("invariant 1: after resolve, register behaves correctly", async () => {
    const storage = createInMemoryStorage();

    const r = "u-test-invariant-001";
    const caps = "u-test-invariant-002";

    // --- AFTER clause ---
    // resolve(target: "linux-x86_64", versionConstraint: ">=1.75") -> ok(toolchain: r, compilerPath: "/usr/local/bin/rustc", version: "1.78.0", capabilities: ["incremental","proc-macros"])
    const step1 = await rusttoolchainHandler.resolve(
      { target: "linux-x86_64", versionConstraint: ">=1.75" },
      storage,
    );
    expect(step1.variant).toBe("ok");
    expect((step1 as any).toolchain).toBe(r);
    expect((step1 as any).compilerPath).toBe("/usr/local/bin/rustc");
    expect((step1 as any).version).toBe("1.78.0");
    expect((step1 as any).capabilities).toEqual(["incremental", "proc-macros"]);

    // --- THEN clause ---
    // register() -> ok(name: "RustToolchain", language: "rust", capabilities: caps)
    const step2 = await rusttoolchainHandler.register(
      {},
      storage,
    );
    expect(step2.variant).toBe("ok");
    expect((step2 as any).name).toBe("RustToolchain");
    expect((step2 as any).language).toBe("rust");
    expect((step2 as any).capabilities).toBe(caps);
  });

});
