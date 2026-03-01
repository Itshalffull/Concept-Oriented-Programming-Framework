// CompensationPlan Concept Implementation
// Track compensating actions for saga-style rollback. As forward steps complete,
// their undo actions are registered. On failure, compensations execute in LIFO order.
import type { ConceptStorage } from "@clef/runtime";
import type { CompensationPlanHandler } from "./compensationplan.handler";

const RELATION = "compensationplan";
const RUN_INDEX_RELATION = "compensationplan_run";

let planCounter = 0;
function nextPlanId(): string {
  planCounter += 1;
  return `cp-${Date.now()}-${String(planCounter).padStart(4, "0")}`;
}

interface CompensationEntry {
  stepKey: string;
  actionDescriptor: string;
  registeredAt: string;
}

export const compensationPlanHandler: CompensationPlanHandler = {
  async register(input, storage) {
    const { runRef, stepKey, actionDescriptor } = input;

    // Look up existing plan for this run
    const runIndex = await storage.get(RUN_INDEX_RELATION, runRef);
    let planId: string;
    let compensations: CompensationEntry[];

    if (runIndex) {
      planId = runIndex.plan as string;
      const record = await storage.get(RELATION, planId);
      compensations = record
        ? JSON.parse(record.compensations as string)
        : [];
    } else {
      planId = nextPlanId();
      compensations = [];
      await storage.put(RUN_INDEX_RELATION, runRef, {
        runRef,
        plan: planId,
      });
    }

    // Append the new compensation entry
    compensations.push({
      stepKey,
      actionDescriptor,
      registeredAt: new Date().toISOString(),
    });

    await storage.put(RELATION, planId, {
      plan: planId,
      runRef,
      status: "dormant",
      compensations: JSON.stringify(compensations),
      currentIndex: compensations.length - 1,
      failedStep: "",
      failedError: "",
    });

    return { variant: "ok", plan: planId };
  },

  async trigger(input, storage) {
    const { runRef } = input;

    const runIndex = await storage.get(RUN_INDEX_RELATION, runRef);
    if (!runIndex) {
      return { variant: "empty", runRef };
    }

    const planId = runIndex.plan as string;
    const record = await storage.get(RELATION, planId);
    if (!record) {
      return { variant: "empty", runRef };
    }

    const compensations: CompensationEntry[] = JSON.parse(record.compensations as string);
    if (compensations.length === 0) {
      return { variant: "empty", runRef };
    }

    const status = record.status as string;
    if (status === "triggered" || status === "executing") {
      return { variant: "alreadyTriggered", runRef };
    }

    // Set currentIndex to the last compensation (LIFO)
    await storage.put(RELATION, planId, {
      ...record,
      status: "triggered",
      currentIndex: compensations.length - 1,
    });

    return { variant: "ok", plan: planId };
  },

  async executeNext(input, storage) {
    const { plan } = input;

    const record = await storage.get(RELATION, plan);
    if (!record) {
      return { variant: "allDone", plan };
    }

    const compensations: CompensationEntry[] = JSON.parse(record.compensations as string);
    const currentIndex = record.currentIndex as number;

    if (currentIndex < 0) {
      // All compensations executed
      await storage.put(RELATION, plan, {
        ...record,
        status: "completed",
      });
      return { variant: "allDone", plan };
    }

    const entry = compensations[currentIndex];

    // Transition to executing and decrement index
    await storage.put(RELATION, plan, {
      ...record,
      status: "executing",
      currentIndex: currentIndex - 1,
    });

    return {
      variant: "ok",
      plan,
      stepKey: entry.stepKey,
      actionDescriptor: entry.actionDescriptor,
    };
  },

  async markCompensationFailed(input, storage) {
    const { plan, stepKey, error } = input;

    const record = await storage.get(RELATION, plan);
    if (record) {
      await storage.put(RELATION, plan, {
        ...record,
        status: "failed",
        failedStep: stepKey,
        failedError: error,
      });
    }

    return { variant: "ok", plan };
  },
};
