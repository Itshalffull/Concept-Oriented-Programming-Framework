import { describe, it, expect } from "vitest";
import { createInMemoryStorage } from "@clef/runtime";
import { compensationPlanHandler } from "./compensationplan.impl";

describe("CompensationPlan business logic", () => {
  it("LIFO execution order: register A, B, C executes C, B, A", async () => {
    const storage = createInMemoryStorage();

    await compensationPlanHandler.register(
      { runRef: "run-1", stepKey: "step-A", actionDescriptor: "undo-A" },
      storage,
    );
    await compensationPlanHandler.register(
      { runRef: "run-1", stepKey: "step-B", actionDescriptor: "undo-B" },
      storage,
    );
    const reg3 = await compensationPlanHandler.register(
      { runRef: "run-1", stepKey: "step-C", actionDescriptor: "undo-C" },
      storage,
    );
    const plan = (reg3 as any).plan;

    // Trigger the compensation plan
    const triggered = await compensationPlanHandler.trigger(
      { runRef: "run-1" },
      storage,
    );
    expect(triggered.variant).toBe("ok");

    // Execute in LIFO order: C first
    const exec1 = await compensationPlanHandler.executeNext({ plan }, storage);
    expect(exec1.variant).toBe("ok");
    expect((exec1 as any).stepKey).toBe("step-C");
    expect((exec1 as any).actionDescriptor).toBe("undo-C");

    // Then B
    const exec2 = await compensationPlanHandler.executeNext({ plan }, storage);
    expect(exec2.variant).toBe("ok");
    expect((exec2 as any).stepKey).toBe("step-B");

    // Then A
    const exec3 = await compensationPlanHandler.executeNext({ plan }, storage);
    expect(exec3.variant).toBe("ok");
    expect((exec3 as any).stepKey).toBe("step-A");

    // All done
    const exec4 = await compensationPlanHandler.executeNext({ plan }, storage);
    expect(exec4.variant).toBe("allDone");
  });

  it("trigger empty plan returns empty", async () => {
    const storage = createInMemoryStorage();

    const result = await compensationPlanHandler.trigger(
      { runRef: "run-no-plan" },
      storage,
    );
    expect(result.variant).toBe("empty");
  });

  it("trigger already-triggered plan returns alreadyTriggered", async () => {
    const storage = createInMemoryStorage();

    await compensationPlanHandler.register(
      { runRef: "run-2", stepKey: "step-X", actionDescriptor: "undo-X" },
      storage,
    );

    await compensationPlanHandler.trigger({ runRef: "run-2" }, storage);

    const result = await compensationPlanHandler.trigger(
      { runRef: "run-2" },
      storage,
    );
    expect(result.variant).toBe("alreadyTriggered");
  });

  it("executeNext after all done returns allDone", async () => {
    const storage = createInMemoryStorage();

    const reg = await compensationPlanHandler.register(
      { runRef: "run-3", stepKey: "only-step", actionDescriptor: "undo-only" },
      storage,
    );
    const plan = (reg as any).plan;

    await compensationPlanHandler.trigger({ runRef: "run-3" }, storage);

    // Execute the single compensation
    const exec1 = await compensationPlanHandler.executeNext({ plan }, storage);
    expect(exec1.variant).toBe("ok");
    expect((exec1 as any).stepKey).toBe("only-step");

    // Now all done
    const exec2 = await compensationPlanHandler.executeNext({ plan }, storage);
    expect(exec2.variant).toBe("allDone");
  });

  it("markCompensationFailed transitions plan to failed state", async () => {
    const storage = createInMemoryStorage();

    await compensationPlanHandler.register(
      { runRef: "run-4", stepKey: "step-F", actionDescriptor: "undo-F" },
      storage,
    );
    await compensationPlanHandler.register(
      { runRef: "run-4", stepKey: "step-G", actionDescriptor: "undo-G" },
      storage,
    );

    const triggered = await compensationPlanHandler.trigger(
      { runRef: "run-4" },
      storage,
    );
    const plan = (triggered as any).plan;

    // Execute first compensation
    await compensationPlanHandler.executeNext({ plan }, storage);

    // Mark it as failed
    const failed = await compensationPlanHandler.markCompensationFailed(
      { plan, stepKey: "step-G", error: "undo failed" },
      storage,
    );
    expect(failed.variant).toBe("ok");
  });

  it("register multiple compensations for same run uses single plan", async () => {
    const storage = createInMemoryStorage();

    const r1 = await compensationPlanHandler.register(
      { runRef: "run-5", stepKey: "s1", actionDescriptor: "undo-s1" },
      storage,
    );
    const r2 = await compensationPlanHandler.register(
      { runRef: "run-5", stepKey: "s2", actionDescriptor: "undo-s2" },
      storage,
    );
    const r3 = await compensationPlanHandler.register(
      { runRef: "run-5", stepKey: "s3", actionDescriptor: "undo-s3" },
      storage,
    );

    // All registrations return the same plan ID
    expect((r1 as any).plan).toBe((r2 as any).plan);
    expect((r2 as any).plan).toBe((r3 as any).plan);
  });

  it("trigger and executeNext return plan ID consistently", async () => {
    const storage = createInMemoryStorage();

    const reg = await compensationPlanHandler.register(
      { runRef: "run-6", stepKey: "step-1", actionDescriptor: "undo-1" },
      storage,
    );
    const regPlan = (reg as any).plan;

    const triggered = await compensationPlanHandler.trigger(
      { runRef: "run-6" },
      storage,
    );
    const trigPlan = (triggered as any).plan;
    expect(trigPlan).toBe(regPlan);

    const exec = await compensationPlanHandler.executeNext(
      { plan: trigPlan },
      storage,
    );
    expect((exec as any).plan).toBe(regPlan);
  });

  it("executeNext on nonexistent plan returns allDone", async () => {
    const storage = createInMemoryStorage();

    const result = await compensationPlanHandler.executeNext(
      { plan: "cp-nonexistent" },
      storage,
    );
    expect(result.variant).toBe("allDone");
  });

  it("plan with many compensations executes all in reverse order", async () => {
    const storage = createInMemoryStorage();

    const stepKeys = ["a", "b", "c", "d", "e"];
    let plan: string = "";
    for (const key of stepKeys) {
      const reg = await compensationPlanHandler.register(
        { runRef: "run-7", stepKey: key, actionDescriptor: `undo-${key}` },
        storage,
      );
      plan = (reg as any).plan;
    }

    await compensationPlanHandler.trigger({ runRef: "run-7" }, storage);

    // Should execute in reverse: e, d, c, b, a
    const executed: string[] = [];
    for (let i = 0; i < stepKeys.length; i++) {
      const exec = await compensationPlanHandler.executeNext({ plan }, storage);
      expect(exec.variant).toBe("ok");
      executed.push((exec as any).stepKey);
    }

    expect(executed).toEqual(["e", "d", "c", "b", "a"]);
  });
});
