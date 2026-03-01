import { describe, it, expect } from "vitest";
import { createInMemoryStorage } from "@clef/runtime";
import { toolRegistryHandler } from "./toolregistry.impl";

describe("ToolRegistry business logic", () => {
  it("register increments version on re-register with same name", async () => {
    const storage = createInMemoryStorage();

    const r1 = await toolRegistryHandler.register(
      {
        name: "search",
        description: "Search the web",
        schema: JSON.stringify({ type: "object", properties: { query: { type: "string" } } }),
      },
      storage,
    );
    expect(r1.variant).toBe("ok");
    expect((r1 as any).version).toBe(1);

    const r2 = await toolRegistryHandler.register(
      {
        name: "search",
        description: "Search the web v2",
        schema: JSON.stringify({ type: "object", properties: { query: { type: "string" }, limit: { type: "number" } } }),
      },
      storage,
    );
    expect(r2.variant).toBe("ok");
    expect((r2 as any).version).toBe(2);
    expect((r2 as any).tool).toBe((r1 as any).tool);
  });

  it("deprecate then checkAccess returns denied", async () => {
    const storage = createInMemoryStorage();

    const reg = await toolRegistryHandler.register(
      {
        name: "old-tool",
        description: "Deprecated tool",
        schema: '{"type":"object"}',
      },
      storage,
    );
    const tool = (reg as any).tool;

    await toolRegistryHandler.deprecate({ tool }, storage);

    const access = await toolRegistryHandler.checkAccess(
      { tool, model: "gpt-4", processRef: "proc-1" },
      storage,
    );
    expect(access.variant).toBe("denied");
    expect((access as any).reason).toContain("deprecated");
  });

  it("disable then checkAccess returns denied", async () => {
    const storage = createInMemoryStorage();

    const reg = await toolRegistryHandler.register(
      {
        name: "unsafe-tool",
        description: "Will be disabled",
        schema: '{"type":"object"}',
      },
      storage,
    );
    const tool = (reg as any).tool;

    await toolRegistryHandler.disable({ tool }, storage);

    const access = await toolRegistryHandler.checkAccess(
      { tool, model: "gpt-4", processRef: "proc-1" },
      storage,
    );
    expect(access.variant).toBe("denied");
    expect((access as any).reason).toContain("disabled");
  });

  it("authorize specific model and process grants access", async () => {
    const storage = createInMemoryStorage();

    const reg = await toolRegistryHandler.register(
      {
        name: "restricted-tool",
        description: "Access controlled",
        schema: '{"type":"object"}',
      },
      storage,
    );
    const tool = (reg as any).tool;

    await toolRegistryHandler.authorize(
      { tool, model: "gpt-4", processRef: "proc-approved" },
      storage,
    );

    const access = await toolRegistryHandler.checkAccess(
      { tool, model: "gpt-4", processRef: "proc-approved" },
      storage,
    );
    expect(access.variant).toBe("allowed");
    expect((access as any).schema).toBe('{"type":"object"}');
  });

  it("checkAccess with unauthorized model returns denied", async () => {
    const storage = createInMemoryStorage();

    const reg = await toolRegistryHandler.register(
      {
        name: "model-restricted",
        description: "Only for specific models",
        schema: '{"type":"object"}',
      },
      storage,
    );
    const tool = (reg as any).tool;

    // By default, the tool has wildcard access ["*"]
    // We need to authorize a specific model to remove wildcard
    // Let's update the storage directly to set specific models
    const record = await storage.get("toolregistry", tool);
    await storage.put("toolregistry", tool, {
      ...record!,
      allowedModels: JSON.stringify(["gpt-4-only"]),
    });

    const access = await toolRegistryHandler.checkAccess(
      { tool, model: "claude-3", processRef: "any-proc" },
      storage,
    );
    expect(access.variant).toBe("denied");
    expect((access as any).reason).toContain("claude-3");
  });

  it("listActive excludes deprecated and disabled tools", async () => {
    const storage = createInMemoryStorage();

    const t1 = await toolRegistryHandler.register(
      { name: "active-tool", description: "Active", schema: '{"a":1}' },
      storage,
    );
    const t2 = await toolRegistryHandler.register(
      { name: "deprecated-tool", description: "Old", schema: '{"b":2}' },
      storage,
    );
    const t3 = await toolRegistryHandler.register(
      { name: "disabled-tool", description: "Off", schema: '{"c":3}' },
      storage,
    );

    await toolRegistryHandler.deprecate({ tool: (t2 as any).tool }, storage);
    await toolRegistryHandler.disable({ tool: (t3 as any).tool }, storage);

    const listed = await toolRegistryHandler.listActive(
      { processRef: "*" },
      storage,
    );
    const tools = JSON.parse((listed as any).tools);

    const names = tools.map((t: any) => t.name);
    expect(names).toContain("active-tool");
    expect(names).not.toContain("deprecated-tool");
    expect(names).not.toContain("disabled-tool");
  });

  it("wildcard authorization allows all models and processes", async () => {
    const storage = createInMemoryStorage();

    const reg = await toolRegistryHandler.register(
      {
        name: "public-tool",
        description: "Open to all",
        schema: '{"type":"object"}',
      },
      storage,
    );
    const tool = (reg as any).tool;

    // Default registration uses ["*"] for both allowedModels and allowedProcesses
    const access1 = await toolRegistryHandler.checkAccess(
      { tool, model: "any-model", processRef: "any-process" },
      storage,
    );
    expect(access1.variant).toBe("allowed");

    const access2 = await toolRegistryHandler.checkAccess(
      { tool, model: "different-model", processRef: "different-process" },
      storage,
    );
    expect(access2.variant).toBe("allowed");
  });

  it("register with invalid schema returns invalidSchema", async () => {
    const storage = createInMemoryStorage();

    const result = await toolRegistryHandler.register(
      {
        name: "bad-schema-tool",
        description: "Invalid JSON schema",
        schema: "not valid json {{{",
      },
      storage,
    );
    expect(result.variant).toBe("invalidSchema");
    expect((result as any).message).toContain("not valid JSON");
  });

  it("checkAccess on nonexistent tool returns denied", async () => {
    const storage = createInMemoryStorage();

    const result = await toolRegistryHandler.checkAccess(
      { tool: "tool-nonexistent", model: "gpt-4", processRef: "proc-1" },
      storage,
    );
    expect(result.variant).toBe("denied");
    expect((result as any).reason).toContain("not found");
  });

  it("multiple re-registers keep incrementing version", async () => {
    const storage = createInMemoryStorage();

    for (let i = 1; i <= 5; i++) {
      const result = await toolRegistryHandler.register(
        {
          name: "evolving-tool",
          description: `Version ${i}`,
          schema: `{"version":${i}}`,
        },
        storage,
      );
      expect((result as any).version).toBe(i);
    }
  });
});
