// generated: rusttoolchain.conformance.test.ts
import { describe, it, expect } from "vitest";
import { createInMemoryStorage } from "@clef/runtime";
import { rusttoolchainHandler } from "./rusttoolchain.impl";

describe("RustToolchain conformance", () => {

  it("invariant 1: after resolve, register behaves correctly", async () => {
    const storage = createInMemoryStorage();

    // --- AFTER clause ---
    // resolve(language: "rust", platform: "x86_64-linux") -> ok(tool: r, path: "/usr/local/bin/rustc", version: "1.77.0", capabilities: ["incremental","proc-macros"])
    const step1 = await rusttoolchainHandler.resolve(
      { language: "rust", platform: "x86_64-linux" },
      storage,
    );
    expect(step1.variant).toBe("ok");
    expect((step1 as any).tool).toBeDefined();
    expect(typeof (step1 as any).path).toBe("string");
    expect(typeof (step1 as any).version).toBe("string");
    expect(Array.isArray((step1 as any).capabilities)).toBe(true);

    // --- THEN clause ---
    // register() -> ok(name: "RustToolchain", language: "rust", capabilities: [...])
    const step2 = await rusttoolchainHandler.register(
      {},
      storage,
    );
    expect(step2.variant).toBe("ok");
    expect((step2 as any).name).toBe("RustToolchain");
    expect((step2 as any).language).toBe("rust");
    expect(Array.isArray((step2 as any).capabilities)).toBe(true);
  });

});
