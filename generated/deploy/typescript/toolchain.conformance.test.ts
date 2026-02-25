// generated: toolchain.conformance.test.ts
import { describe, it, expect } from "vitest";
import { createInMemoryStorage } from "@copf/runtime";
import { toolchainHandler } from "./toolchain.impl";

describe("Toolchain conformance", () => {

  it("invariant 1: after resolve, validate and list behave correctly", async () => {
    const storage = createInMemoryStorage();

    // --- AFTER clause ---
    // resolve(language: "swift", platform: "macos") -> ok(tool: t, version: "5.10.1", path: "/usr/bin/swiftc", capabilities: ["cross-compile"])
    const step1 = await toolchainHandler.resolve(
      { language: "swift", platform: "macos" },
      storage,
    );
    expect(step1.variant).toBe("ok");
    expect((step1 as any).tool).toBeDefined();
    expect(typeof (step1 as any).version).toBe("string");
    expect(typeof (step1 as any).path).toBe("string");
    expect(Array.isArray((step1 as any).capabilities)).toBe(true);

    const toolId = (step1 as any).tool;
    const resolvedVersion = (step1 as any).version;

    // --- THEN clause ---
    // validate(tool: t) -> ok(tool: t, version: "5.10.1")
    const step2 = await toolchainHandler.validate(
      { tool: toolId },
      storage,
    );
    expect(step2.variant).toBe("ok");
    expect((step2 as any).tool).toBe(toolId);
    expect((step2 as any).version).toBe(resolvedVersion);

    // list(language: "swift") -> ok(tools: [...])
    const step3 = await toolchainHandler.list(
      { language: "swift" },
      storage,
    );
    expect(step3.variant).toBe("ok");
    const tools = (step3 as any).tools;
    expect(Array.isArray(tools)).toBe(true);
    expect(tools.length).toBeGreaterThanOrEqual(1);
    expect(tools[0].language).toBe("swift");
  });

});
