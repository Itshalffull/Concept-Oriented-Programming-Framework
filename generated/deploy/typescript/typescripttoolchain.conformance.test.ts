// generated: typescripttoolchain.conformance.test.ts
import { describe, it, expect } from "vitest";
import { createInMemoryStorage } from "@copf/runtime";
import { typescripttoolchainHandler } from "./typescripttoolchain.impl";

describe("TypeScriptToolchain conformance", () => {

  it("invariant 1: after resolve, register behaves correctly", async () => {
    const storage = createInMemoryStorage();

    const n = "u-test-invariant-001";
    const caps = "u-test-invariant-002";

    // --- AFTER clause ---
    // resolve(target: "node-20", versionConstraint: ">=5.7") -> ok(toolchain: n, compilerPath: "/usr/local/bin/tsc", version: "5.7.2", capabilities: ["esm","declaration-maps"])
    const step1 = await typescripttoolchainHandler.resolve(
      { target: "node-20", versionConstraint: ">=5.7" },
      storage,
    );
    expect(step1.variant).toBe("ok");
    expect((step1 as any).toolchain).toBe(n);
    expect((step1 as any).compilerPath).toBe("/usr/local/bin/tsc");
    expect((step1 as any).version).toBe("5.7.2");
    expect((step1 as any).capabilities).toEqual(["esm", "declaration-maps"]);

    // --- THEN clause ---
    // register() -> ok(name: "TypeScriptToolchain", language: "typescript", capabilities: caps)
    const step2 = await typescripttoolchainHandler.register(
      {},
      storage,
    );
    expect(step2.variant).toBe("ok");
    expect((step2 as any).name).toBe("TypeScriptToolchain");
    expect((step2 as any).language).toBe("typescript");
    expect((step2 as any).capabilities).toBe(caps);
  });

});
