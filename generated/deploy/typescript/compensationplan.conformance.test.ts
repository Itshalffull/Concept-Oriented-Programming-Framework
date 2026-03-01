// generated: compensationplan.conformance.test.ts
import { describe, it, expect } from "vitest";
import { createInMemoryStorage } from "@clef/runtime";
import { compensationPlanHandler } from "./compensationplan.impl";

describe("CompensationPlan conformance", () => {

  it("register multiple steps, trigger, then executeNext in LIFO order", async () => {
    const storage = createInMemoryStorage();

    // Register three forward steps with their compensations
    const r1 = await compensationPlanHandler.register(
      { runRef: "run-1", stepKey: "debit-account", actionDescriptor: "credit-account:$100" },
      storage,
    );
    expect(r1.variant).toBe("ok");
    const plan = (r1 as any).plan;

    const r2 = await compensationPlanHandler.register(
      { runRef: "run-1", stepKey: "reserve-inventory", actionDescriptor: "release-inventory:item-42" },
      storage,
    );
    expect((r2 as any).plan).toBe(plan);

    const r3 = await compensationPlanHandler.register(
      { runRef: "run-1", stepKey: "send-notification", actionDescriptor: "send-cancellation:order-1" },
      storage,
    );
    expect((r3 as any).plan).toBe(plan);

    // Trigger compensation
    const t1 = await compensationPlanHandler.trigger(
      { runRef: "run-1" },
      storage,
    );
    expect(t1.variant).toBe("ok");

    // Execute in LIFO order: send-notification first (index 2)
    const e1 = await compensationPlanHandler.executeNext(
      { plan },
      storage,
    );
    expect(e1.variant).toBe("ok");
    expect((e1 as any).stepKey).toBe("send-notification");
    expect((e1 as any).actionDescriptor).toBe("send-cancellation:order-1");

    // Next: reserve-inventory (index 1)
    const e2 = await compensationPlanHandler.executeNext(
      { plan },
      storage,
    );
    expect(e2.variant).toBe("ok");
    expect((e2 as any).stepKey).toBe("reserve-inventory");

    // Next: debit-account (index 0)
    const e3 = await compensationPlanHandler.executeNext(
      { plan },
      storage,
    );
    expect(e3.variant).toBe("ok");
    expect((e3 as any).stepKey).toBe("debit-account");

    // All done
    const e4 = await compensationPlanHandler.executeNext(
      { plan },
      storage,
    );
    expect(e4.variant).toBe("allDone");
  });

  it("trigger on empty run returns empty", async () => {
    const storage = createInMemoryStorage();

    const step1 = await compensationPlanHandler.trigger(
      { runRef: "run-no-compensations" },
      storage,
    );
    expect(step1.variant).toBe("empty");
  });

  it("trigger on already triggered plan returns alreadyTriggered", async () => {
    const storage = createInMemoryStorage();

    await compensationPlanHandler.register(
      { runRef: "run-2", stepKey: "step-a", actionDescriptor: "undo-a" },
      storage,
    );

    await compensationPlanHandler.trigger(
      { runRef: "run-2" },
      storage,
    );

    const step2 = await compensationPlanHandler.trigger(
      { runRef: "run-2" },
      storage,
    );
    expect(step2.variant).toBe("alreadyTriggered");
  });

  it("markCompensationFailed transitions plan to failed", async () => {
    const storage = createInMemoryStorage();

    await compensationPlanHandler.register(
      { runRef: "run-3", stepKey: "payment", actionDescriptor: "refund" },
      storage,
    );

    const t1 = await compensationPlanHandler.trigger(
      { runRef: "run-3" },
      storage,
    );
    const plan = (t1 as any).plan;

    const e1 = await compensationPlanHandler.executeNext(
      { plan },
      storage,
    );
    expect(e1.variant).toBe("ok");

    // Mark compensation as failed
    const step1 = await compensationPlanHandler.markCompensationFailed(
      { plan, stepKey: "payment", error: "refund gateway unavailable" },
      storage,
    );
    expect(step1.variant).toBe("ok");
  });

});
