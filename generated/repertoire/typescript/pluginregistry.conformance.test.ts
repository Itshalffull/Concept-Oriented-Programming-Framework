// generated: pluginregistry.conformance.test.ts
import { describe, it, expect } from "vitest";
import { createInMemoryStorage } from "@clef/runtime";
import { pluginregistryHandler } from "./pluginregistry.impl";

describe("PluginRegistry conformance", () => {

  it("invariant 1: after discover, createInstance, getDefinitions behaves correctly", async () => {
    const storage = createInMemoryStorage();

    let ps = "u-test-invariant-001";
    let p = "u-test-invariant-002";
    let i = "u-test-invariant-003";
    let ds = "u-test-invariant-004";

    // --- AFTER clause ---
    // discover(type: "formatter") -> ok(plugins: ps)
    const step1 = await pluginregistryHandler.discover(
      { type: "formatter" },
      storage,
    );
    expect(step1.variant).toBe("ok");
    ps = (step1 as any).plugins;

    // --- THEN clause ---
    // createInstance(plugin: p, config: "{}") -> ok(instance: i)
    const step2 = await pluginregistryHandler.createInstance(
      { plugin: p, config: "{}" },
      storage,
    );
    expect(step2.variant).toBe("ok");
    i = (step2 as any).instance;
    // getDefinitions(type: "formatter") -> ok(definitions: ds)
    const step3 = await pluginregistryHandler.getDefinitions(
      { type: "formatter" },
      storage,
    );
    expect(step3.variant).toBe("ok");
    ds = (step3 as any).definitions;
  });

});
