// generated: soliditytoolchain.conformance.test.ts
import { describe, it, expect } from "vitest";
import { createInMemoryStorage } from "@copf/runtime";
import { soliditytoolchainHandler } from "./soliditytoolchain.impl";

describe("SolidityToolchain conformance", () => {

  it("invariant 1: after resolve, register behaves correctly", async () => {
    const storage = createInMemoryStorage();

    const l = "u-test-invariant-001";
    const caps = "u-test-invariant-002";

    // --- AFTER clause ---
    // resolve(target: "evm-shanghai", versionConstraint: ">=0.8.20") -> ok(toolchain: l, compilerPath: "/usr/local/bin/solc", version: "0.8.25", capabilities: ["optimizer","via-ir"])
    const step1 = await soliditytoolchainHandler.resolve(
      { target: "evm-shanghai", versionConstraint: ">=0.8.20" },
      storage,
    );
    expect(step1.variant).toBe("ok");
    expect((step1 as any).toolchain).toBe(l);
    expect((step1 as any).compilerPath).toBe("/usr/local/bin/solc");
    expect((step1 as any).version).toBe("0.8.25");
    expect((step1 as any).capabilities).toEqual(["optimizer", "via-ir"]);

    // --- THEN clause ---
    // register() -> ok(name: "SolidityToolchain", language: "solidity", capabilities: caps)
    const step2 = await soliditytoolchainHandler.register(
      {},
      storage,
    );
    expect(step2.variant).toBe("ok");
    expect((step2 as any).name).toBe("SolidityToolchain");
    expect((step2 as any).language).toBe("solidity");
    expect((step2 as any).capabilities).toBe(caps);
  });

});
