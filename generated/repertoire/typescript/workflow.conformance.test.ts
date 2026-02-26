// generated: workflow.conformance.test.ts
import { describe, it, expect } from "vitest";
import { createInMemoryStorage } from "@clef/runtime";
import { workflowHandler } from "./workflow.impl";

describe("Workflow conformance", () => {

  it("invariant 1: after defineState, defineState, defineTransition, transition, getCurrentState behaves correctly", async () => {
    const storage = createInMemoryStorage();

    const w = "u-test-invariant-001";

    // --- AFTER clause ---
    // defineState(workflow: w, name: "draft", flags: "initial") -> ok()
    const step1 = await workflowHandler.defineState(
      { workflow: w, name: "draft", flags: "initial" },
      storage,
    );
    expect(step1.variant).toBe("ok");

    // --- THEN clause ---
    // defineState(workflow: w, name: "published", flags: "") -> ok()
    const step2 = await workflowHandler.defineState(
      { workflow: w, name: "published", flags: "" },
      storage,
    );
    expect(step2.variant).toBe("ok");
    // defineTransition(workflow: w, from: "draft", to: "published", label: "publish", guard: "approved") -> ok()
    const step3 = await workflowHandler.defineTransition(
      { workflow: w, from: "draft", to: "published", label: "publish", guard: "approved" },
      storage,
    );
    expect(step3.variant).toBe("ok");
    // transition(workflow: w, entity: "doc1", transition: "publish") -> ok(newState: "published")
    const step4 = await workflowHandler.transition(
      { workflow: w, entity: "doc1", transition: "publish" },
      storage,
    );
    expect(step4.variant).toBe("ok");
    expect((step4 as any).newState).toBe("published");
    // getCurrentState(workflow: w, entity: "doc1") -> ok(state: "published")
    const step5 = await workflowHandler.getCurrentState(
      { workflow: w, entity: "doc1" },
      storage,
    );
    expect(step5.variant).toBe("ok");
    expect((step5 as any).state).toBe("published");
  });

});
