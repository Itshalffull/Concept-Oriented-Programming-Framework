// generated: pluginregistry.conformance.test.ts
import { describe, it, expect } from "vitest";
import { createInMemoryStorage } from "@clef/runtime";
import { pluginregistryHandler } from "./pluginregistry.impl";

describe("PluginRegistry conformance", () => {

  it("invariant 1: after discover, createInstance, getDefinitions behaves correctly", async () => {
    const storage = createInMemoryStorage();

    const ps = "u-test-invariant-001";
    const p = "u-test-invariant-002";
    const i = "u-test-invariant-003";
    const ds = "u-test-invariant-004";

    // --- AFTER clause ---
    // discover(type: "formatter") -> ok(plugins: ps)
    const step1 = await pluginregistryHandler.discover(
      { type: "formatter" },
      storage,
    );
    expect(step1.variant).toBe("ok");
    expect((step1 as any).plugins).toBe(ps);

    // --- THEN clause ---
    // createInstance(plugin: p, config: "{}") -> ok(instance: i)
    const step2 = await pluginregistryHandler.createInstance(
      { plugin: p, config: "{}" },
      storage,
    );
    expect(step2.variant).toBe("ok");
    expect((step2 as any).instance).toBe(i);
    // getDefinitions(type: "formatter") -> ok(definitions: ds)
    const step3 = await pluginregistryHandler.getDefinitions(
      { type: "formatter" },
      storage,
    );
    expect(step3.variant).toBe("ok");
    expect((step3 as any).definitions).toBe(ds);
  });

});
