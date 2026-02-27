// generated: expressionlanguage.conformance.test.ts
import { describe, it, expect } from "vitest";
import { createInMemoryStorage } from "@clef/runtime";
import { expressionlanguageHandler } from "./expressionlanguage.impl";

describe("ExpressionLanguage conformance", () => {

  it("invariant 1: after registerLanguage, parse, evaluate behaves correctly", async () => {
    const storage = createInMemoryStorage();

    let e = "u-test-invariant-001";

    // --- AFTER clause ---
    // registerLanguage(name: "math", grammar: "arithmetic") -> ok()
    const step1 = await expressionlanguageHandler.registerLanguage(
      { name: "math", grammar: "arithmetic" },
      storage,
    );
    expect(step1.variant).toBe("ok");

    // --- THEN clause ---
    // parse(expression: e, text: "2 + 3", language: "math") -> ok(ast: "add(2, 3)")
    const step2 = await expressionlanguageHandler.parse(
      { expression: e, text: "2 + 3", language: "math" },
      storage,
    );
    expect(step2.variant).toBe("ok");
    expect((step2 as any).ast).toBe("add(2, 3)");
    // evaluate(expression: e) -> ok(result: "5")
    const step3 = await expressionlanguageHandler.evaluate(
      { expression: e },
      storage,
    );
    expect(step3.variant).toBe("ok");
    expect((step3 as any).result).toBe("5");
  });

});
