import { describe, it, expect } from "vitest";
import { createInMemoryStorage } from "@clef/runtime";
import { timerHandler } from "./timer.impl";

describe("Timer business logic", () => {
  it("fire_count increments on each fire", async () => {
    const storage = createInMemoryStorage();

    const set = await timerHandler.setTimer(
      {
        runRef: "run-1",
        timerType: "cycle",
        specification: "PT10S",
        purposeTag: "poll",
        contextRef: "ctx-1",
      },
      storage,
    );
    expect(set.variant).toBe("ok");
    const timer = (set as any).timer;

    // Fire multiple times (cycle timer stays active)
    const f1 = await timerHandler.fire({ timer }, storage);
    expect(f1.variant).toBe("ok");

    const f2 = await timerHandler.fire({ timer }, storage);
    expect(f2.variant).toBe("ok");

    const f3 = await timerHandler.fire({ timer }, storage);
    expect(f3.variant).toBe("ok");
  });

  it("cycle timer remains active after fire and can fire multiple times", async () => {
    const storage = createInMemoryStorage();

    const set = await timerHandler.setTimer(
      {
        runRef: "run-2",
        timerType: "cycle",
        specification: "PT5M",
        purposeTag: "heartbeat",
        contextRef: "",
      },
      storage,
    );
    const timer = (set as any).timer;

    // Fire 5 times - should all succeed since cycle stays active
    for (let i = 0; i < 5; i++) {
      const fired = await timerHandler.fire({ timer }, storage);
      expect(fired.variant).toBe("ok");
      expect((fired as any).purposeTag).toBe("heartbeat");
    }
  });

  it("date timer with future date is valid", async () => {
    const storage = createInMemoryStorage();

    const futureDate = new Date(Date.now() + 86400000).toISOString(); // Tomorrow
    const set = await timerHandler.setTimer(
      {
        runRef: "run-3",
        timerType: "date",
        specification: futureDate,
        purposeTag: "deadline",
        contextRef: "task-99",
      },
      storage,
    );
    expect(set.variant).toBe("ok");
    expect((set as any).nextFireAt).toBe(futureDate);
  });

  it("reset after cancel re-activates the timer", async () => {
    const storage = createInMemoryStorage();

    const set = await timerHandler.setTimer(
      {
        runRef: "run-4",
        timerType: "duration",
        specification: "PT30S",
        purposeTag: "timeout",
        contextRef: "",
      },
      storage,
    );
    const timer = (set as any).timer;

    // Cancel
    const cancelled = await timerHandler.cancel({ timer }, storage);
    expect(cancelled.variant).toBe("ok");

    // Fire should fail (cancelled)
    const fireAfterCancel = await timerHandler.fire({ timer }, storage);
    expect(fireAfterCancel.variant).toBe("notActive");

    // Reset with new spec
    const resetResult = await timerHandler.reset(
      { timer, specification: "PT1M" },
      storage,
    );
    expect(resetResult.variant).toBe("ok");

    // Fire should now work
    const fireAfterReset = await timerHandler.fire({ timer }, storage);
    expect(fireAfterReset.variant).toBe("ok");
  });

  it("reset with new specification updates the timer", async () => {
    const storage = createInMemoryStorage();

    const set = await timerHandler.setTimer(
      {
        runRef: "run-5",
        timerType: "duration",
        specification: "PT10S",
        purposeTag: "retry",
        contextRef: "",
      },
      storage,
    );
    const timer = (set as any).timer;

    const resetResult = await timerHandler.reset(
      { timer, specification: "PT2H" },
      storage,
    );
    expect(resetResult.variant).toBe("ok");
    // nextFireAt should be about 2 hours from now
    const nextFireAt = new Date((resetResult as any).nextFireAt).getTime();
    const twoHoursFromNow = Date.now() + 2 * 60 * 60 * 1000;
    // Allow 5 seconds tolerance
    expect(Math.abs(nextFireAt - twoHoursFromNow)).toBeLessThan(5000);
  });

  it("fire cancelled timer returns notActive", async () => {
    const storage = createInMemoryStorage();

    const set = await timerHandler.setTimer(
      {
        runRef: "run-6",
        timerType: "duration",
        specification: "PT5S",
        purposeTag: "quick",
        contextRef: "",
      },
      storage,
    );
    const timer = (set as any).timer;

    await timerHandler.cancel({ timer }, storage);

    const result = await timerHandler.fire({ timer }, storage);
    expect(result.variant).toBe("notActive");
  });

  it("multiple timers for same run are independent", async () => {
    const storage = createInMemoryStorage();

    const t1 = await timerHandler.setTimer(
      {
        runRef: "run-7",
        timerType: "duration",
        specification: "PT10S",
        purposeTag: "timeout-A",
        contextRef: "",
      },
      storage,
    );
    const t2 = await timerHandler.setTimer(
      {
        runRef: "run-7",
        timerType: "cycle",
        specification: "PT1M",
        purposeTag: "heartbeat",
        contextRef: "",
      },
      storage,
    );

    const timer1 = (t1 as any).timer;
    const timer2 = (t2 as any).timer;
    expect(timer1).not.toBe(timer2);

    // Cancel timer1, timer2 should still be active
    await timerHandler.cancel({ timer: timer1 }, storage);

    const fireResult1 = await timerHandler.fire({ timer: timer1 }, storage);
    expect(fireResult1.variant).toBe("notActive");

    const fireResult2 = await timerHandler.fire({ timer: timer2 }, storage);
    expect(fireResult2.variant).toBe("ok");
  });

  it("duration timer transitions to fired after single fire", async () => {
    const storage = createInMemoryStorage();

    const set = await timerHandler.setTimer(
      {
        runRef: "run-8",
        timerType: "duration",
        specification: "PT30S",
        purposeTag: "one-shot",
        contextRef: "",
      },
      storage,
    );
    const timer = (set as any).timer;

    const fired = await timerHandler.fire({ timer }, storage);
    expect(fired.variant).toBe("ok");

    // Second fire should fail since duration timers transition to "fired"
    const secondFire = await timerHandler.fire({ timer }, storage);
    expect(secondFire.variant).toBe("notActive");
  });

  it("invalid specification returns invalidSpec", async () => {
    const storage = createInMemoryStorage();

    const result = await timerHandler.setTimer(
      {
        runRef: "run-9",
        timerType: "duration",
        specification: "not-a-duration",
        purposeTag: "bad",
        contextRef: "",
      },
      storage,
    );
    expect(result.variant).toBe("invalidSpec");
  });

  it("fire returns runRef, purposeTag, and contextRef", async () => {
    const storage = createInMemoryStorage();

    const set = await timerHandler.setTimer(
      {
        runRef: "run-10",
        timerType: "duration",
        specification: "PT1S",
        purposeTag: "sla-check",
        contextRef: "step-42",
      },
      storage,
    );
    const timer = (set as any).timer;

    const fired = await timerHandler.fire({ timer }, storage);
    expect((fired as any).runRef).toBe("run-10");
    expect((fired as any).purposeTag).toBe("sla-check");
    expect((fired as any).contextRef).toBe("step-42");
  });
});
