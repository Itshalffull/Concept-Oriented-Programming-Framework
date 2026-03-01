// generated: toolregistry.conformance.test.ts
import { describe, it, expect } from "vitest";
import { createInMemoryStorage } from "@clef/runtime";
import { toolRegistryHandler } from "./toolregistry.impl";

describe("ToolRegistry conformance", () => {

  it("register creates a tool with version 1, re-register increments version", async () => {
    const storage = createInMemoryStorage();

    const step1 = await toolRegistryHandler.register(
      { name: "web_search", description: "Search the web", schema: '{"type":"object","properties":{"query":{"type":"string"}}}' },
      storage,
    );
    expect(step1.variant).toBe("ok");
    expect((step1 as any).version).toBe(1);
    const tool = (step1 as any).tool;

    // Re-register same name increments version
    const step2 = await toolRegistryHandler.register(
      { name: "web_search", description: "Search the web v2", schema: '{"type":"object","properties":{"query":{"type":"string"},"limit":{"type":"number"}}}' },
      storage,
    );
    expect(step2.variant).toBe("ok");
    expect((step2 as any).version).toBe(2);
  });

  it("register with invalid JSON schema returns invalidSchema", async () => {
    const storage = createInMemoryStorage();

    const step1 = await toolRegistryHandler.register(
      { name: "bad_tool", description: "Bad", schema: "not json at all {" },
      storage,
    );
    expect(step1.variant).toBe("invalidSchema");
  });

  it("checkAccess on active tool with wildcard auth returns allowed", async () => {
    const storage = createInMemoryStorage();

    const step1 = await toolRegistryHandler.register(
      { name: "calculator", description: "Math operations", schema: '{"type":"object"}' },
      storage,
    );
    const tool = (step1 as any).tool;

    // Default allows all models and processes (wildcard)
    const step2 = await toolRegistryHandler.checkAccess(
      { tool, model: "claude-sonnet-4-5-20250929", processRef: "invoice-process" },
      storage,
    );
    expect(step2.variant).toBe("allowed");
    expect((step2 as any).schema).toBe('{"type":"object"}');
  });

  it("checkAccess on disabled tool returns denied", async () => {
    const storage = createInMemoryStorage();

    const step1 = await toolRegistryHandler.register(
      { name: "old_tool", description: "Legacy", schema: '{}' },
      storage,
    );
    const tool = (step1 as any).tool;

    await toolRegistryHandler.disable({ tool }, storage);

    const step3 = await toolRegistryHandler.checkAccess(
      { tool, model: "gpt-4", processRef: "any" },
      storage,
    );
    expect(step3.variant).toBe("denied");
    expect((step3 as any).reason).toBe("Tool is disabled");
  });

  it("checkAccess on deprecated tool returns denied", async () => {
    const storage = createInMemoryStorage();

    const step1 = await toolRegistryHandler.register(
      { name: "legacy_search", description: "Old search", schema: '{}' },
      storage,
    );
    const tool = (step1 as any).tool;

    await toolRegistryHandler.deprecate({ tool }, storage);

    const step3 = await toolRegistryHandler.checkAccess(
      { tool, model: "gpt-4", processRef: "any" },
      storage,
    );
    expect(step3.variant).toBe("denied");
    expect((step3 as any).reason).toBe("Tool is deprecated");
  });

  it("authorize then checkAccess works for specific model/process pair", async () => {
    const storage = createInMemoryStorage();

    const step1 = await toolRegistryHandler.register(
      { name: "restricted_tool", description: "Restricted", schema: '{"restricted":true}' },
      storage,
    );
    const tool = (step1 as any).tool;

    await toolRegistryHandler.authorize(
      { tool, model: "claude-sonnet-4-5-20250929", processRef: "secure-process" },
      storage,
    );

    const step3 = await toolRegistryHandler.checkAccess(
      { tool, model: "claude-sonnet-4-5-20250929", processRef: "secure-process" },
      storage,
    );
    expect(step3.variant).toBe("allowed");
  });

  it("listActive returns all active tools for a process", async () => {
    const storage = createInMemoryStorage();

    await toolRegistryHandler.register(
      { name: "tool_a", description: "Tool A", schema: '{"a":true}' },
      storage,
    );
    await toolRegistryHandler.register(
      { name: "tool_b", description: "Tool B", schema: '{"b":true}' },
      storage,
    );

    const step3 = await toolRegistryHandler.listActive(
      { processRef: "my-process" },
      storage,
    );
    expect(step3.variant).toBe("ok");
    const tools = JSON.parse((step3 as any).tools);
    expect(tools.length).toBeGreaterThanOrEqual(2);
  });

  it("deprecate transitions tool from active to deprecated", async () => {
    const storage = createInMemoryStorage();

    const step1 = await toolRegistryHandler.register(
      { name: "dep_tool", description: "Will deprecate", schema: '{}' },
      storage,
    );
    const tool = (step1 as any).tool;

    const step2 = await toolRegistryHandler.deprecate({ tool }, storage);
    expect(step2.variant).toBe("ok");
  });

});
