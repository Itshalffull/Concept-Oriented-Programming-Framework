// Timer Concept Implementation
// Time-based triggers for process execution: absolute dates, relative durations, and recurring cycles.
import type { ConceptStorage } from "@clef/runtime";
import type { TimerHandler } from "./timer.handler";

const RELATION = "timer";

let timerCounter = 0;
function nextTimerId(): string {
  timerCounter += 1;
  return `tmr-${Date.now()}-${String(timerCounter).padStart(4, "0")}`;
}

/** Parse an ISO 8601 duration string (e.g. PT30S, PT5M, PT1H) into milliseconds. */
function parseDurationMs(spec: string): number | null {
  const match = spec.match(/^PT(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?$/i);
  if (!match) return null;
  const hours = parseInt(match[1] || "0", 10);
  const minutes = parseInt(match[2] || "0", 10);
  const seconds = parseInt(match[3] || "0", 10);
  if (hours === 0 && minutes === 0 && seconds === 0) return null;
  return (hours * 3600 + minutes * 60 + seconds) * 1000;
}

/** Compute the next fire time based on timer type and specification. */
function computeNextFireAt(timerType: string, specification: string): string | null {
  if (timerType === "date") {
    // Specification is an ISO 8601 date
    const d = new Date(specification);
    if (isNaN(d.getTime())) return null;
    return d.toISOString();
  }

  if (timerType === "duration" || timerType === "cycle") {
    const ms = parseDurationMs(specification);
    if (ms === null) return null;
    return new Date(Date.now() + ms).toISOString();
  }

  return null;
}

export const timerHandler: TimerHandler = {
  async setTimer(input, storage) {
    const { runRef, timerType, specification, purposeTag, contextRef } = input;

    const nextFireAt = computeNextFireAt(timerType, specification);
    if (nextFireAt === null) {
      return { variant: "invalidSpec", specification };
    }

    const timerId = nextTimerId();

    await storage.put(RELATION, timerId, {
      timer: timerId,
      runRef,
      purposeTag,
      timerType,
      specification,
      status: "active",
      fireCount: 0,
      nextFireAt,
      contextRef,
    });

    return { variant: "ok", timer: timerId, runRef, nextFireAt };
  },

  async fire(input, storage) {
    const { timer } = input;

    const record = await storage.get(RELATION, timer);
    if (!record) {
      return { variant: "notActive", timer };
    }

    if (record.status !== "active") {
      return { variant: "notActive", timer };
    }

    const fireCount = ((record.fireCount as number) || 0) + 1;
    const timerType = record.timerType as string;
    const specification = record.specification as string;

    if (timerType === "cycle") {
      // Cycle timers remain active and compute next fire time
      const nextFireAt = computeNextFireAt("cycle", specification);
      await storage.put(RELATION, timer, {
        ...record,
        fireCount,
        nextFireAt: nextFireAt || "",
      });
    } else {
      // Date and duration timers transition to fired
      await storage.put(RELATION, timer, {
        ...record,
        status: "fired",
        fireCount,
        nextFireAt: "",
      });
    }

    return {
      variant: "ok",
      timer,
      runRef: record.runRef as string,
      purposeTag: record.purposeTag as string,
      contextRef: (record.contextRef as string) || "",
    };
  },

  async cancel(input, storage) {
    const { timer } = input;

    const record = await storage.get(RELATION, timer);
    if (!record) {
      return { variant: "notActive", timer };
    }

    if (record.status !== "active") {
      return { variant: "notActive", timer };
    }

    await storage.put(RELATION, timer, {
      ...record,
      status: "cancelled",
      nextFireAt: "",
    });

    return { variant: "ok", timer };
  },

  async reset(input, storage) {
    const { timer, specification } = input;

    const record = await storage.get(RELATION, timer);
    const timerType = record ? (record.timerType as string) : "duration";
    const nextFireAt = computeNextFireAt(timerType, specification) || new Date(Date.now() + 60000).toISOString();

    if (record) {
      await storage.put(RELATION, timer, {
        ...record,
        status: "active",
        specification,
        nextFireAt,
        fireCount: 0,
      });
    }

    return { variant: "ok", timer, nextFireAt };
  },
};
