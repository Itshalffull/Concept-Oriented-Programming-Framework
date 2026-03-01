// generated: processrun.impl.ts
import type { ConceptStorage } from "@clef/runtime";
import type { ProcessRunHandler } from "./processrun.handler";

async function nextId(storage: ConceptStorage): Promise<string> {
  const counter = await storage.get("_idCounter", "_processrun");
  const next = counter ? (counter.value as number) + 1 : 1;
  await storage.put("_idCounter", "_processrun", { value: next });
  return `run-${String(next).padStart(6, "0")}`;
}

const TERMINAL_STATUSES = new Set(["completed", "failed", "cancelled"]);

export const processRunHandler: ProcessRunHandler = {
  async start(input, storage) {
    const run = await nextId(storage);
    const now = new Date().toISOString();

    await storage.put("run", run, {
      id: run,
      spec_ref: input.spec_ref,
      spec_version: input.spec_version,
      status: "running",
      parent_run: null,
      started_at: now,
      ended_at: null,
      input: input.input,
      output: null,
      error: null,
    });

    return { variant: "ok", run, spec_ref: input.spec_ref };
  },

  async startChild(input, storage) {
    const run = await nextId(storage);
    const now = new Date().toISOString();

    await storage.put("run", run, {
      id: run,
      spec_ref: input.spec_ref,
      spec_version: input.spec_version,
      status: "running",
      parent_run: input.parent_run,
      started_at: now,
      ended_at: null,
      input: input.input,
      output: null,
      error: null,
    });

    return { variant: "ok", run, parent_run: input.parent_run };
  },

  async complete(input, storage) {
    const record = await storage.get("run", input.run);
    if (!record || (record.status as string) !== "running") {
      return { variant: "not_running", run: input.run };
    }

    const now = new Date().toISOString();
    await storage.put("run", input.run, {
      ...record,
      status: "completed",
      ended_at: now,
      output: input.output,
    });

    return { variant: "ok", run: input.run };
  },

  async fail(input, storage) {
    const record = await storage.get("run", input.run);
    if (!record || (record.status as string) !== "running") {
      return { variant: "not_running", run: input.run };
    }

    const now = new Date().toISOString();
    await storage.put("run", input.run, {
      ...record,
      status: "failed",
      ended_at: now,
      error: input.error,
    });

    return { variant: "ok", run: input.run, error: input.error };
  },

  async cancel(input, storage) {
    const record = await storage.get("run", input.run);
    if (!record) {
      return { variant: "not_cancellable", run: input.run };
    }

    const status = record.status as string;
    if (TERMINAL_STATUSES.has(status)) {
      return { variant: "not_cancellable", run: input.run };
    }

    const now = new Date().toISOString();
    await storage.put("run", input.run, {
      ...record,
      status: "cancelled",
      ended_at: now,
    });

    return { variant: "ok", run: input.run };
  },

  async suspend(input, storage) {
    const record = await storage.get("run", input.run);
    if (!record || (record.status as string) !== "running") {
      return { variant: "not_running", run: input.run };
    }

    await storage.put("run", input.run, {
      ...record,
      status: "suspended",
    });

    return { variant: "ok", run: input.run };
  },

  async resume(input, storage) {
    const record = await storage.get("run", input.run);
    if (!record || (record.status as string) !== "suspended") {
      return { variant: "not_suspended", run: input.run };
    }

    await storage.put("run", input.run, {
      ...record,
      status: "running",
    });

    return { variant: "ok", run: input.run };
  },

  async getStatus(input, storage) {
    const record = await storage.get("run", input.run);
    if (!record) {
      return { variant: "not_found", run: input.run };
    }

    return {
      variant: "ok",
      run: input.run,
      status: record.status as string,
      spec_ref: record.spec_ref as string,
    };
  },
};
