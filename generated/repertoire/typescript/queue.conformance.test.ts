// generated: queue.conformance.test.ts
import { describe, it, expect } from "vitest";
import { createInMemoryStorage } from "@clef/runtime";
import { queueHandler } from "./queue.impl";

describe("Queue conformance", () => {

  it("invariant 1: after enqueue, claim, process behaves correctly", async () => {
    const storage = createInMemoryStorage();

    let q = "u-test-invariant-001";

    // --- AFTER clause ---
    // enqueue(queue: q, item: "send_email", priority: 1) -> ok(itemId: "item-1")
    const step1 = await queueHandler.enqueue(
      { queue: q, item: "send_email", priority: 1 },
      storage,
    );
    expect(step1.variant).toBe("ok");
    expect((step1 as any).itemId).toBe("item-1");

    // --- THEN clause ---
    // claim(queue: q, worker: "worker-a") -> ok(item: "send_email")
    const step2 = await queueHandler.claim(
      { queue: q, worker: "worker-a" },
      storage,
    );
    expect(step2.variant).toBe("ok");
    expect((step2 as any).item).toBe("send_email");
    // process(queue: q, itemId: "item-1", result: "sent") -> ok()
    const step3 = await queueHandler.process(
      { queue: q, itemId: "item-1", result: "sent" },
      storage,
    );
    expect(step3.variant).toBe("ok");
  });

});
