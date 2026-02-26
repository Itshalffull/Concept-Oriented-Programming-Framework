// generated: renderer.conformance.test.ts
import { describe, it, expect } from "vitest";
import { createInMemoryStorage } from "@clef/runtime";
import { rendererHandler } from "./renderer.impl";

describe("Renderer conformance", () => {

  it("invariant 1: after render, render behaves correctly", async () => {
    const storage = createInMemoryStorage();

    let r = "u-test-invariant-001";

    // --- AFTER clause ---
    // render(renderer: r, tree: "<page><header/><body/></page>") -> ok(output: _)
    const step1 = await rendererHandler.render(
      { renderer: r, tree: "<page><header/><body/></page>" },
      storage,
    );
    expect(step1.variant).toBe("ok");
    expect((step1 as any).output).toBeDefined();

    // --- THEN clause ---
    // render(renderer: r, tree: "<page><header/><body/></page>") -> ok(output: _)
    const step2 = await rendererHandler.render(
      { renderer: r, tree: "<page><header/><body/></page>" },
      storage,
    );
    expect(step2.variant).toBe("ok");
    expect((step2 as any).output).toBeDefined();
  });

  it("invariant 2: after autoPlaceholder, render behaves correctly", async () => {
    const storage = createInMemoryStorage();

    let r = "u-test-invariant-001";
    let p = "u-test-invariant-002";

    // --- AFTER clause ---
    // autoPlaceholder(renderer: r, name: "sidebar") -> ok(placeholder: p)
    const step1 = await rendererHandler.autoPlaceholder(
      { renderer: r, name: "sidebar" },
      storage,
    );
    expect(step1.variant).toBe("ok");
    p = (step1 as any).placeholder;

    // --- THEN clause ---
    // render(renderer: r, tree: p) -> ok(output: _)
    const step2 = await rendererHandler.render(
      { renderer: r, tree: p },
      storage,
    );
    expect(step2.variant).toBe("ok");
    expect((step2 as any).output).toBeDefined();
  });

});
