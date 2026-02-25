// generated: typescripttoolchain.conformance.test.ts
import { describe, it, expect } from "vitest";
import { createInMemoryStorage } from "@copf/runtime";
import { typescripttoolchainHandler } from "./typescripttoolchain.impl";

describe("TypeScriptToolchain conformance", () => {

  it("invariant 1: after resolve, register behaves correctly", async () => {
    const storage = createInMemoryStorage();

    // --- AFTER clause ---
    // resolve(language: "typescript", platform: "node") -> ok(tool: n, path: "/usr/local/bin/tsc", version: "5.4.0", capabilities: ["esm","declaration-maps"])
    const step1 = await typescripttoolchainHandler.resolve(
      { language: "typescript", platform: "node" },
      storage,
    );
    expect(step1.variant).toBe("ok");
    expect((step1 as any).tool).toBeDefined();
    expect(typeof (step1 as any).path).toBe("string");
    expect(typeof (step1 as any).version).toBe("string");
    expect(Array.isArray((step1 as any).capabilities)).toBe(true);

    // --- THEN clause ---
    // register() -> ok(name: "TypeScriptToolchain", language: "typescript", capabilities: [...])
    const step2 = await typescripttoolchainHandler.register(
      {},
      storage,
    );
    expect(step2.variant).toBe("ok");
    expect((step2 as any).name).toBe("TypeScriptToolchain");
    expect((step2 as any).language).toBe("typescript");
    expect(Array.isArray((step2 as any).capabilities)).toBe(true);
  });

});
