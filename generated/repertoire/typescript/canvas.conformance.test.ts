// generated: canvas.conformance.test.ts
import { describe, it, expect } from "vitest";
import { createInMemoryStorage } from "@clef/runtime";
import { canvasHandler } from "./canvas.impl";

describe("Canvas conformance", () => {

  it("invariant 1: after addNode, moveNode, connectNodes behaves correctly", async () => {
    const storage = createInMemoryStorage();

    const v = "u-test-invariant-001";

    // --- AFTER clause ---
    // addNode(canvas: v, node: "a", x: 0, y: 0) -> ok()
    const step1 = await canvasHandler.addNode(
      { canvas: v, node: "a", x: 0, y: 0 },
      storage,
    );
    expect(step1.variant).toBe("ok");

    // --- THEN clause ---
    // moveNode(canvas: v, node: "a", x: 100, y: 200) -> ok()
    const step2 = await canvasHandler.moveNode(
      { canvas: v, node: "a", x: 100, y: 200 },
      storage,
    );
    expect(step2.variant).toBe("ok");
    // connectNodes(canvas: v, from: "a", to: "b") -> ok()
    const step3 = await canvasHandler.connectNodes(
      { canvas: v, from: "a", to: "b" },
      storage,
    );
    expect(step3.variant).toBe("ok");
  });

});
