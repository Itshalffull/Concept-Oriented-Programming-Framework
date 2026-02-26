// generated: swifttoolchain.conformance.test.ts
import { describe, it, expect } from "vitest";
import { createInMemoryStorage } from "@clef/runtime";
import { swifttoolchainHandler } from "./swifttoolchain.impl";

describe("SwiftToolchain conformance", () => {

  it("invariant 1: after resolve, register behaves correctly", async () => {
    const storage = createInMemoryStorage();

    // --- AFTER clause ---
    // resolve(language: "swift", platform: "macos") -> ok(tool: s, path: "/usr/bin/swiftc", version: "5.10.1", capabilities: ["macros","swift-testing"])
    const step1 = await swifttoolchainHandler.resolve(
      { language: "swift", platform: "macos" },
      storage,
    );
    expect(step1.variant).toBe("ok");
    expect((step1 as any).tool).toBeDefined();
    expect(typeof (step1 as any).path).toBe("string");
    expect(typeof (step1 as any).version).toBe("string");
    expect(Array.isArray((step1 as any).capabilities)).toBe(true);

    // --- THEN clause ---
    // register() -> ok(name: "SwiftToolchain", language: "swift", capabilities: [...])
    const step2 = await swifttoolchainHandler.register(
      {},
      storage,
    );
    expect(step2.variant).toBe("ok");
    expect((step2 as any).name).toBe("SwiftToolchain");
    expect((step2 as any).language).toBe("swift");
    expect(Array.isArray((step2 as any).capabilities)).toBe(true);
  });

});
