// generated: steprun.impl.ts
import type { ConceptStorage } from "@clef/runtime";
import type { StepRunHandler } from "./steprun.handler";

async function nextId(storage: ConceptStorage): Promise<string> {
  const counter = await storage.get("_idCounter", "_steprun");
  const next = counter ? (counter.value as number) + 1 : 1;
  await storage.put("_idCounter", "_steprun", { value: next });
  return `step-${String(next).padStart(6, "0")}`;
}

const TERMINAL_STATUSES = new Set(["completed", "failed", "cancelled", "skipped"]);

export const stepRunHandler: StepRunHandler = {
  async start(input, storage) {
    // Check for existing active step with same run_ref + step_key
    const compositeKey = `${input.run_ref}::${input.step_key}`;
    const existing = await storage.get("stepByKey", compositeKey);

    if (existing) {
      const existingStep = await storage.get("step", existing.stepId as string);
      if (existingStep && (existingStep.status as string) === "active") {
        return { variant: "already_active", step: existing.stepId as string };
      }
    }

    // Determine attempt number (retry if previous attempt failed)
    let attempt = 1;
    if (existing) {
      const existingStep = await storage.get("step", existing.stepId as string);
      if (existingStep && (existingStep.status as string) === "failed") {
        attempt = (existingStep.attempt as number) + 1;
      }
    }

    const step = await nextId(storage);
    const now = new Date().toISOString();

    await storage.put("step", step, {
      id: step,
      run_ref: input.run_ref,
      step_key: input.step_key,
      step_type: input.step_type,
      status: "active",
      attempt,
      input: input.input,
      output: null,
      error: null,
      started_at: now,
      ended_at: null,
    });

    // Update composite key index
    await storage.put("stepByKey", compositeKey, { stepId: step });

    return {
      variant: "ok",
      step,
      run_ref: input.run_ref,
      step_key: input.step_key,
      step_type: input.step_type,
    };
  },

  async complete(input, storage) {
    const record = await storage.get("step", input.step);
    if (!record || (record.status as string) !== "active") {
      return { variant: "not_active", step: input.step };
    }

    const now = new Date().toISOString();
    await storage.put("step", input.step, {
      ...record,
      status: "completed",
      output: input.output,
      ended_at: now,
    });

    return {
      variant: "ok",
      step: input.step,
      run_ref: record.run_ref as string,
      step_key: record.step_key as string,
      output: input.output,
    };
  },

  async fail(input, storage) {
    const record = await storage.get("step", input.step);
    if (!record || (record.status as string) !== "active") {
      return { variant: "not_active", step: input.step };
    }

    const now = new Date().toISOString();
    await storage.put("step", input.step, {
      ...record,
      status: "failed",
      error: input.error,
      ended_at: now,
    });

    return {
      variant: "error",
      step: input.step,
      run_ref: record.run_ref as string,
      step_key: record.step_key as string,
      message: input.error,
    };
  },

  async cancel(input, storage) {
    const record = await storage.get("step", input.step);
    if (!record) {
      return { variant: "not_cancellable", step: input.step };
    }

    const status = record.status as string;
    if (TERMINAL_STATUSES.has(status)) {
      return { variant: "not_cancellable", step: input.step };
    }

    const now = new Date().toISOString();
    await storage.put("step", input.step, {
      ...record,
      status: "cancelled",
      ended_at: now,
    });

    return { variant: "ok", step: input.step };
  },

  async skip(input, storage) {
    const record = await storage.get("step", input.step);
    if (!record || (record.status as string) !== "pending") {
      return { variant: "not_pending", step: input.step };
    }

    await storage.put("step", input.step, {
      ...record,
      status: "skipped",
    });

    return { variant: "ok", step: input.step };
  },

  async get(input, storage) {
    const record = await storage.get("step", input.step);
    if (!record) {
      return { variant: "not_found", step: input.step };
    }

    return {
      variant: "ok",
      step: input.step,
      run_ref: record.run_ref as string,
      step_key: record.step_key as string,
      status: record.status as string,
      attempt: record.attempt as number,
    };
  },
};
