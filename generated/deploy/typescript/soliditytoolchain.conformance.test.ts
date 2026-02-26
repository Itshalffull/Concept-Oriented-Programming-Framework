// generated: soliditytoolchain.conformance.test.ts
import { describe, it, expect } from "vitest";
import { createInMemoryStorage } from "@clef/runtime";
import { soliditytoolchainHandler } from "./soliditytoolchain.impl";

describe("SolidityToolchain conformance", () => {

  it("invariant 1: after resolve, register behaves correctly", async () => {
    const storage = createInMemoryStorage();

    // --- AFTER clause ---
    // resolve(language: "solidity", platform: "shanghai") -> ok(tool: l, path: "/usr/local/bin/solc", version: "0.8.25", capabilities: ["optimizer","via-ir"])
    const step1 = await soliditytoolchainHandler.resolve(
      { language: "solidity", platform: "shanghai" },
      storage,
    );
    expect(step1.variant).toBe("ok");
    expect((step1 as any).tool).toBeDefined();
    expect(typeof (step1 as any).path).toBe("string");
    expect(typeof (step1 as any).version).toBe("string");
    expect(Array.isArray((step1 as any).capabilities)).toBe(true);

    // --- THEN clause ---
    // register() -> ok(name: "SolidityToolchain", language: "solidity", capabilities: [...])
    const step2 = await soliditytoolchainHandler.register(
      {},
      storage,
    );
    expect(step2.variant).toBe("ok");
    expect((step2 as any).name).toBe("SolidityToolchain");
    expect((step2 as any).language).toBe("solidity");
    expect(Array.isArray((step2 as any).capabilities)).toBe(true);
  });

});
