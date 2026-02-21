// generated: graph.conformance.test.ts
import { describe, it, expect } from "vitest";
import { createInMemoryStorage } from "@copf/runtime";
import { graphHandler } from "./graph.impl";

describe("Graph conformance", () => {

  it("invariant 1: after addNode, addNode, addEdge, getNeighbors behaves correctly", async () => {
    const storage = createInMemoryStorage();

    const g = "u-test-invariant-001";

    // --- AFTER clause ---
    // addNode(graph: g, node: "A") -> ok()
    const step1 = await graphHandler.addNode(
      { graph: g, node: "A" },
      storage,
    );
    expect(step1.variant).toBe("ok");

    // --- THEN clause ---
    // addNode(graph: g, node: "B") -> ok()
    const step2 = await graphHandler.addNode(
      { graph: g, node: "B" },
      storage,
    );
    expect(step2.variant).toBe("ok");
    // addEdge(graph: g, source: "A", target: "B") -> ok()
    const step3 = await graphHandler.addEdge(
      { graph: g, source: "A", target: "B" },
      storage,
    );
    expect(step3.variant).toBe("ok");
    // getNeighbors(graph: g, node: "A", depth: 1) -> ok(neighbors: "B")
    const step4 = await graphHandler.getNeighbors(
      { graph: g, node: "A", depth: 1 },
      storage,
    );
    expect(step4.variant).toBe("ok");
    expect((step4 as any).neighbors).toBe("B");
  });

});
