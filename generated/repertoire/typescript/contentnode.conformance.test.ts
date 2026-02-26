// generated: contentnode.conformance.test.ts
import { describe, it, expect } from "vitest";
import { createInMemoryStorage } from "@clef/runtime";
import { contentnodeHandler } from "./contentnode.impl";

describe("ContentNode conformance", () => {

  it("invariant 1: after create, get behaves correctly", async () => {
    const storage = createInMemoryStorage();

    let x = "u-test-invariant-001";

    // --- AFTER clause ---
    // create(node: x, type: "page", content: "Hello", createdBy: "user1") -> ok(node: x)
    const step1 = await contentnodeHandler.create(
      { node: x, type: "page", content: "Hello", createdBy: "user1" },
      storage,
    );
    expect(step1.variant).toBe("ok");
    x = (step1 as any).node;

    // --- THEN clause ---
    // get(node: x) -> ok(node: x, type: "page", content: "Hello", metadata: "")
    const step2 = await contentnodeHandler.get(
      { node: x },
      storage,
    );
    expect(step2.variant).toBe("ok");
    x = (step2 as any).node;
    expect((step2 as any).type).toBe("page");
    expect((step2 as any).content).toBe("Hello");
    expect((step2 as any).metadata).toBe("");
  });

  it("invariant 2: after create, create behaves correctly", async () => {
    const storage = createInMemoryStorage();

    let x = "u-test-invariant-001";

    // --- AFTER clause ---
    // create(node: x, type: "page", content: "Hello", createdBy: "user1") -> ok(node: x)
    const step1 = await contentnodeHandler.create(
      { node: x, type: "page", content: "Hello", createdBy: "user1" },
      storage,
    );
    expect(step1.variant).toBe("ok");
    expect((step1 as any).node).toBe(x);

    // --- THEN clause ---
    // create(node: x, type: "page", content: "Again", createdBy: "user2") -> exists(message: "already exists")
    const step2 = await contentnodeHandler.create(
      { node: x, type: "page", content: "Again", createdBy: "user2" },
      storage,
    );
    expect(step2.variant).toBe("exists");
    expect((step2 as any).message).toBe("already exists");
  });

});
