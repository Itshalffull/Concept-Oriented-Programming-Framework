// generated: milestone.conformance.test.ts
import { describe, it, expect } from "vitest";
import { createInMemoryStorage } from "@clef/runtime";
import { milestoneHandler } from "./milestone.impl";

describe("Milestone conformance", () => {

  it("define creates a pending milestone, evaluate with true condition achieves it", async () => {
    const storage = createInMemoryStorage();

    const step1 = await milestoneHandler.define(
      { runRef: "run-1", name: "payment_received", conditionExpr: "amount >= 100" },
      storage,
    );
    expect(step1.variant).toBe("ok");
    const milestone = (step1 as any).milestone;

    // Evaluate with context where condition is true
    const step2 = await milestoneHandler.evaluate(
      { milestone, context: '{"amount":150}' },
      storage,
    );
    expect(step2.variant).toBe("achieved");
    expect((step2 as any).name).toBe("payment_received");
    expect((step2 as any).runRef).toBe("run-1");
  });

  it("evaluate with false condition returns notYet", async () => {
    const storage = createInMemoryStorage();

    const step1 = await milestoneHandler.define(
      { runRef: "run-2", name: "inventory_sufficient", conditionExpr: "stock > 50" },
      storage,
    );
    const milestone = (step1 as any).milestone;

    const step2 = await milestoneHandler.evaluate(
      { milestone, context: '{"stock":30}' },
      storage,
    );
    expect(step2.variant).toBe("notYet");
  });

  it("evaluate on already achieved milestone returns alreadyAchieved", async () => {
    const storage = createInMemoryStorage();

    const step1 = await milestoneHandler.define(
      { runRef: "run-3", name: "kyc_complete", conditionExpr: "true" },
      storage,
    );
    const milestone = (step1 as any).milestone;

    // Achieve it
    await milestoneHandler.evaluate(
      { milestone, context: '{}' },
      storage,
    );

    // Second evaluate returns alreadyAchieved
    const step3 = await milestoneHandler.evaluate(
      { milestone, context: '{}' },
      storage,
    );
    expect(step3.variant).toBe("alreadyAchieved");
  });

  it("revoke returns achieved milestone to pending, allowing re-evaluation", async () => {
    const storage = createInMemoryStorage();

    const step1 = await milestoneHandler.define(
      { runRef: "run-4", name: "threshold_met", conditionExpr: "score >= 80" },
      storage,
    );
    const milestone = (step1 as any).milestone;

    // Achieve
    await milestoneHandler.evaluate(
      { milestone, context: '{"score":90}' },
      storage,
    );

    // Revoke
    const step3 = await milestoneHandler.revoke(
      { milestone },
      storage,
    );
    expect(step3.variant).toBe("ok");

    // Now evaluation with false condition returns notYet (no longer alreadyAchieved)
    const step4 = await milestoneHandler.evaluate(
      { milestone, context: '{"score":50}' },
      storage,
    );
    expect(step4.variant).toBe("notYet");

    // Re-achieve with passing condition
    const step5 = await milestoneHandler.evaluate(
      { milestone, context: '{"score":85}' },
      storage,
    );
    expect(step5.variant).toBe("achieved");
  });

  it("evaluate with equality condition", async () => {
    const storage = createInMemoryStorage();

    const step1 = await milestoneHandler.define(
      { runRef: "run-5", name: "status_approved", conditionExpr: "status == approved" },
      storage,
    );
    const milestone = (step1 as any).milestone;

    const step2 = await milestoneHandler.evaluate(
      { milestone, context: '{"status":"approved"}' },
      storage,
    );
    expect(step2.variant).toBe("achieved");
  });

  it("evaluate with field exists condition", async () => {
    const storage = createInMemoryStorage();

    const step1 = await milestoneHandler.define(
      { runRef: "run-6", name: "signature_present", conditionExpr: "signature exists" },
      storage,
    );
    const milestone = (step1 as any).milestone;

    // Without signature
    const step2 = await milestoneHandler.evaluate(
      { milestone, context: '{"name":"Alice"}' },
      storage,
    );
    expect(step2.variant).toBe("notYet");

    // With signature
    const step3 = await milestoneHandler.evaluate(
      { milestone, context: '{"name":"Alice","signature":"abc123"}' },
      storage,
    );
    expect(step3.variant).toBe("achieved");
  });

});
