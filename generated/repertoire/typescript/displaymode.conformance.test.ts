// generated: displaymode.conformance.test.ts
import { describe, it, expect } from "vitest";
import { createInMemoryStorage } from "@clef/runtime";
import { displaymodeHandler } from "./displaymode.impl";

describe("DisplayMode conformance", () => {

  it("invariant 1: after defineMode, configureFieldDisplay behaves correctly", async () => {
    const storage = createInMemoryStorage();

    let d = "u-test-invariant-001";

    // --- AFTER clause ---
    // defineMode(mode: d, name: "teaser") -> ok(mode: d)
    const step1 = await displaymodeHandler.defineMode(
      { mode: d, name: "teaser" },
      storage,
    );
    expect(step1.variant).toBe("ok");
    d = (step1 as any).mode;

    // --- THEN clause ---
    // configureFieldDisplay(mode: d, field: "title", config: "truncated") -> ok(mode: d)
    const step2 = await displaymodeHandler.configureFieldDisplay(
      { mode: d, field: "title", config: "truncated" },
      storage,
    );
    expect(step2.variant).toBe("ok");
    d = (step2 as any).mode;
  });

  it("invariant 2: after configureFieldDisplay, renderInMode behaves correctly", async () => {
    const storage = createInMemoryStorage();

    let d = "u-test-invariant-001";

    // --- AFTER clause ---
    // configureFieldDisplay(mode: d, field: "title", config: "truncated") -> ok(mode: d)
    const step1 = await displaymodeHandler.configureFieldDisplay(
      { mode: d, field: "title", config: "truncated" },
      storage,
    );
    expect(step1.variant).toBe("ok");
    expect((step1 as any).mode).toBe(d);

    // --- THEN clause ---
    // renderInMode(mode: d, entity: "article-1") -> ok(output: _)
    const step2 = await displaymodeHandler.renderInMode(
      { mode: d, entity: "article-1" },
      storage,
    );
    expect(step2.variant).toBe("ok");
    expect((step2 as any).output).toBeDefined();
  });

});
