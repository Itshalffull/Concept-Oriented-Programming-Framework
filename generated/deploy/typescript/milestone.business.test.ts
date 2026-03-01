import { describe, it, expect } from "vitest";
import { createInMemoryStorage } from "@clef/runtime";
import { milestoneHandler } from "./milestone.impl";

describe("Milestone business logic", () => {
  it("define, evaluate(true), achieved lifecycle", async () => {
    const storage = createInMemoryStorage();

    const defined = await milestoneHandler.define(
      {
        runRef: "run-1",
        name: "order_confirmed",
        conditionExpr: "status == confirmed",
      },
      storage,
    );
    expect(defined.variant).toBe("ok");
    const milestone = (defined as any).milestone;

    const evaluated = await milestoneHandler.evaluate(
      {
        milestone,
        context: JSON.stringify({ status: "confirmed" }),
      },
      storage,
    );
    expect(evaluated.variant).toBe("achieved");
    expect((evaluated as any).name).toBe("order_confirmed");
    expect((evaluated as any).runRef).toBe("run-1");
  });

  it("evaluate(false) returns notYet", async () => {
    const storage = createInMemoryStorage();

    const defined = await milestoneHandler.define(
      {
        runRef: "run-2",
        name: "payment_received",
        conditionExpr: "amount >= 100",
      },
      storage,
    );
    const milestone = (defined as any).milestone;

    const evaluated = await milestoneHandler.evaluate(
      {
        milestone,
        context: JSON.stringify({ amount: 50 }),
      },
      storage,
    );
    expect(evaluated.variant).toBe("notYet");
  });

  it("evaluate already-achieved milestone returns alreadyAchieved", async () => {
    const storage = createInMemoryStorage();

    const defined = await milestoneHandler.define(
      {
        runRef: "run-3",
        name: "goal_met",
        conditionExpr: "true",
      },
      storage,
    );
    const milestone = (defined as any).milestone;

    // First evaluation achieves it
    await milestoneHandler.evaluate(
      { milestone, context: "{}" },
      storage,
    );

    // Second evaluation returns alreadyAchieved
    const second = await milestoneHandler.evaluate(
      { milestone, context: "{}" },
      storage,
    );
    expect(second.variant).toBe("alreadyAchieved");
  });

  it("revoke then evaluate again allows re-achievement", async () => {
    const storage = createInMemoryStorage();

    const defined = await milestoneHandler.define(
      {
        runRef: "run-4",
        name: "threshold_check",
        conditionExpr: "score > 80",
      },
      storage,
    );
    const milestone = (defined as any).milestone;

    // Achieve
    await milestoneHandler.evaluate(
      { milestone, context: JSON.stringify({ score: 90 }) },
      storage,
    );

    // Revoke
    const revoked = await milestoneHandler.revoke({ milestone }, storage);
    expect(revoked.variant).toBe("ok");

    // Can now evaluate again - with failing context
    const evalFail = await milestoneHandler.evaluate(
      { milestone, context: JSON.stringify({ score: 70 }) },
      storage,
    );
    expect(evalFail.variant).toBe("notYet");

    // And with passing context
    const evalPass = await milestoneHandler.evaluate(
      { milestone, context: JSON.stringify({ score: 95 }) },
      storage,
    );
    expect(evalPass.variant).toBe("achieved");
  });

  it("multiple milestones for same run are independent", async () => {
    const storage = createInMemoryStorage();

    const m1 = await milestoneHandler.define(
      { runRef: "run-5", name: "started", conditionExpr: "true" },
      storage,
    );
    const m2 = await milestoneHandler.define(
      { runRef: "run-5", name: "completed", conditionExpr: "false" },
      storage,
    );

    const milestone1 = (m1 as any).milestone;
    const milestone2 = (m2 as any).milestone;

    // Achieve m1
    const e1 = await milestoneHandler.evaluate(
      { milestone: milestone1, context: "{}" },
      storage,
    );
    expect(e1.variant).toBe("achieved");

    // m2 should still be notYet
    const e2 = await milestoneHandler.evaluate(
      { milestone: milestone2, context: "{}" },
      storage,
    );
    expect(e2.variant).toBe("notYet");
  });

  it("define with equality condition expression", async () => {
    const storage = createInMemoryStorage();

    const defined = await milestoneHandler.define(
      {
        runRef: "run-6",
        name: "status_check",
        conditionExpr: "status == active",
      },
      storage,
    );
    const milestone = (defined as any).milestone;

    // Should not match
    const evalPending = await milestoneHandler.evaluate(
      { milestone, context: JSON.stringify({ status: "pending" }) },
      storage,
    );
    expect(evalPending.variant).toBe("notYet");

    // After revoke (not needed since not achieved)
    const evalActive = await milestoneHandler.evaluate(
      { milestone, context: JSON.stringify({ status: "active" }) },
      storage,
    );
    expect(evalActive.variant).toBe("achieved");
  });

  it("define with greater-than condition expression", async () => {
    const storage = createInMemoryStorage();

    const defined = await milestoneHandler.define(
      { runRef: "run-7", name: "high_score", conditionExpr: "points > 1000" },
      storage,
    );
    const milestone = (defined as any).milestone;

    const low = await milestoneHandler.evaluate(
      { milestone, context: JSON.stringify({ points: 500 }) },
      storage,
    );
    expect(low.variant).toBe("notYet");

    const high = await milestoneHandler.evaluate(
      { milestone, context: JSON.stringify({ points: 1500 }) },
      storage,
    );
    expect(high.variant).toBe("achieved");
  });

  it("define with greater-than-or-equal condition expression", async () => {
    const storage = createInMemoryStorage();

    const defined = await milestoneHandler.define(
      { runRef: "run-8", name: "threshold_met", conditionExpr: "value >= 100" },
      storage,
    );
    const milestone = (defined as any).milestone;

    // Exactly at threshold
    const exact = await milestoneHandler.evaluate(
      { milestone, context: JSON.stringify({ value: 100 }) },
      storage,
    );
    expect(exact.variant).toBe("achieved");
  });

  it("define with exists condition expression", async () => {
    const storage = createInMemoryStorage();

    const defined = await milestoneHandler.define(
      { runRef: "run-9", name: "field_present", conditionExpr: "approval exists" },
      storage,
    );
    const milestone = (defined as any).milestone;

    const without = await milestoneHandler.evaluate(
      { milestone, context: JSON.stringify({ other: "data" }) },
      storage,
    );
    expect(without.variant).toBe("notYet");

    // Revoke not needed - wasn't achieved
    const withField = await milestoneHandler.evaluate(
      { milestone, context: JSON.stringify({ approval: "granted" }) },
      storage,
    );
    expect(withField.variant).toBe("achieved");
  });

  it("evaluate on nonexistent milestone returns notYet", async () => {
    const storage = createInMemoryStorage();

    const result = await milestoneHandler.evaluate(
      { milestone: "ms-nonexistent", context: "{}" },
      storage,
    );
    expect(result.variant).toBe("notYet");
  });

  it("revoke on non-achieved milestone still succeeds (resets to pending)", async () => {
    const storage = createInMemoryStorage();

    const defined = await milestoneHandler.define(
      { runRef: "run-10", name: "never_achieved", conditionExpr: "false" },
      storage,
    );
    const milestone = (defined as any).milestone;

    // Revoke even though it's still pending
    const result = await milestoneHandler.revoke({ milestone }, storage);
    expect(result.variant).toBe("ok");
  });
});
