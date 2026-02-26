// generated: contentparser.conformance.test.ts
import { describe, it, expect } from "vitest";
import { createInMemoryStorage } from "@clef/runtime";
import { contentparserHandler } from "./contentparser.impl";

describe("ContentParser conformance", () => {

  it("invariant 1: after registerFormat, parse, extractTags behaves correctly", async () => {
    const storage = createInMemoryStorage();

    let c = "u-test-invariant-001";
    let a = "u-test-invariant-002";
    let t = "u-test-invariant-003";

    // --- AFTER clause ---
    // registerFormat(name: "markdown", grammar: "{}") -> ok(name: "markdown")
    const step1 = await contentparserHandler.registerFormat(
      { name: "markdown", grammar: "{}" },
      storage,
    );
    expect(step1.variant).toBe("ok");
    expect((step1 as any).name).toBe("markdown");
    // parse(content: c, text: "Hello #tag [[ref]]", format: "markdown") -> ok(ast: a)
    const step2 = await contentparserHandler.parse(
      { content: c, text: "Hello #tag [[ref]]", format: "markdown" },
      storage,
    );
    expect(step2.variant).toBe("ok");
    a = (step2 as any).ast;

    // --- THEN clause ---
    // extractTags(content: c) -> ok(tags: t)
    const step3 = await contentparserHandler.extractTags(
      { content: c },
      storage,
    );
    expect(step3.variant).toBe("ok");
    t = (step3 as any).tags;
  });

});
