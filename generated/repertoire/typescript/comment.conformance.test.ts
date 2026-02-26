// generated: comment.conformance.test.ts
import { describe, it, expect } from "vitest";
import { createInMemoryStorage } from "@clef/runtime";
import { commentHandler } from "./comment.impl";

describe("Comment conformance", () => {

  it("invariant 1: after addComment, reply behaves correctly", async () => {
    const storage = createInMemoryStorage();

    let c = "u-test-invariant-001";
    let e = "u-test-invariant-002";
    let r = "u-test-invariant-003";

    // --- AFTER clause ---
    // addComment(comment: c, entity: e, content: "Hello", author: "alice") -> ok(comment: c)
    const step1 = await commentHandler.addComment(
      { comment: c, entity: e, content: "Hello", author: "alice" },
      storage,
    );
    expect(step1.variant).toBe("ok");
    c = (step1 as any).comment;

    // --- THEN clause ---
    // reply(comment: r, parent: c, content: "Reply", author: "bob") -> ok(comment: r)
    const step2 = await commentHandler.reply(
      { comment: r, parent: c, content: "Reply", author: "bob" },
      storage,
    );
    expect(step2.variant).toBe("ok");
    r = (step2 as any).comment;
  });

});
