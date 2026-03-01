// generated: timer.conformance.test.ts
import { describe, it, expect } from "vitest";
import { createInMemoryStorage } from "@clef/runtime";
import { timerHandler } from "./timer.impl";

describe("Timer conformance", () => {

  it("setTimer creates a duration timer, fire transitions to fired", async () => {
    const storage = createInMemoryStorage();

    const step1 = await timerHandler.setTimer(
      { runRef: "run-1", timerType: "duration", specification: "PT30S", purposeTag: "retry", contextRef: "step-a" },
      storage,
    );
    expect(step1.variant).toBe("ok");
    const timer = (step1 as any).timer;
    expect((step1 as any).runRef).toBe("run-1");
    expect((step1 as any).nextFireAt).toBeTruthy();

    // Fire the timer
    const step2 = await timerHandler.fire(
      { timer },
      storage,
    );
    expect(step2.variant).toBe("ok");
    expect((step2 as any).runRef).toBe("run-1");
    expect((step2 as any).purposeTag).toBe("retry");
    expect((step2 as any).contextRef).toBe("step-a");

    // Firing again should fail (duration timer is now fired)
    const step3 = await timerHandler.fire(
      { timer },
      storage,
    );
    expect(step3.variant).toBe("notActive");
  });

  it("setTimer with invalid spec returns invalidSpec", async () => {
    const storage = createInMemoryStorage();

    const step1 = await timerHandler.setTimer(
      { runRef: "run-2", timerType: "duration", specification: "not-valid", purposeTag: "sla", contextRef: "" },
      storage,
    );
    expect(step1.variant).toBe("invalidSpec");
    expect((step1 as any).specification).toBe("not-valid");
  });

  it("cancel transitions active timer to cancelled", async () => {
    const storage = createInMemoryStorage();

    const step1 = await timerHandler.setTimer(
      { runRef: "run-3", timerType: "duration", specification: "PT5M", purposeTag: "escalation", contextRef: "task-1" },
      storage,
    );
    const timer = (step1 as any).timer;

    const step2 = await timerHandler.cancel(
      { timer },
      storage,
    );
    expect(step2.variant).toBe("ok");

    // Firing cancelled timer fails
    const step3 = await timerHandler.fire(
      { timer },
      storage,
    );
    expect(step3.variant).toBe("notActive");
  });

  it("cancel on non-active timer returns notActive", async () => {
    const storage = createInMemoryStorage();

    const step1 = await timerHandler.cancel(
      { timer: "tmr-nonexistent" },
      storage,
    );
    expect(step1.variant).toBe("notActive");
  });

  it("cycle timer remains active after fire", async () => {
    const storage = createInMemoryStorage();

    const step1 = await timerHandler.setTimer(
      { runRef: "run-4", timerType: "cycle", specification: "PT10S", purposeTag: "schedule", contextRef: "job-1" },
      storage,
    );
    const timer = (step1 as any).timer;

    // First fire
    const step2 = await timerHandler.fire(
      { timer },
      storage,
    );
    expect(step2.variant).toBe("ok");

    // Second fire should also succeed (cycle stays active)
    const step3 = await timerHandler.fire(
      { timer },
      storage,
    );
    expect(step3.variant).toBe("ok");
  });

  it("reset reactivates a fired timer with new specification", async () => {
    const storage = createInMemoryStorage();

    const step1 = await timerHandler.setTimer(
      { runRef: "run-5", timerType: "duration", specification: "PT1S", purposeTag: "retry", contextRef: "" },
      storage,
    );
    const timer = (step1 as any).timer;

    await timerHandler.fire({ timer }, storage);

    // Reset with new spec
    const step3 = await timerHandler.reset(
      { timer, specification: "PT1H" },
      storage,
    );
    expect(step3.variant).toBe("ok");
    expect((step3 as any).nextFireAt).toBeTruthy();

    // Should be able to fire again
    const step4 = await timerHandler.fire(
      { timer },
      storage,
    );
    expect(step4.variant).toBe("ok");
  });

  it("date timer with valid ISO date", async () => {
    const storage = createInMemoryStorage();

    const futureDate = new Date(Date.now() + 86400000).toISOString();
    const step1 = await timerHandler.setTimer(
      { runRef: "run-6", timerType: "date", specification: futureDate, purposeTag: "deadline", contextRef: "doc-1" },
      storage,
    );
    expect(step1.variant).toBe("ok");
    expect((step1 as any).nextFireAt).toBe(futureDate);
  });

});
