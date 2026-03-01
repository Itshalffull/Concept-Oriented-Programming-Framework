// generated: workitem.impl.ts
import type { ConceptStorage } from "@clef/runtime";
import type { WorkItemHandler } from "./workitem.handler";

async function nextId(storage: ConceptStorage): Promise<string> {
  const counter = await storage.get("_idCounter", "_workitem");
  const next = counter ? (counter.value as number) + 1 : 1;
  await storage.put("_idCounter", "_workitem", { value: next });
  return `wi-${String(next).padStart(6, "0")}`;
}

export const workItemHandler: WorkItemHandler = {
  async create(input, storage) {
    const item = await nextId(storage);

    await storage.put("item", item, {
      id: item,
      step_ref: input.step_ref,
      status: "offered",
      assignee: null,
      candidate_pool: input.candidate_pool,
      form_schema: input.form_schema,
      form_data: null,
      priority: input.priority,
      due_at: null,
      claimed_at: null,
      completed_at: null,
    });

    return { variant: "ok", item, step_ref: input.step_ref };
  },

  async claim(input, storage) {
    const record = await storage.get("item", input.item);
    if (!record || (record.status as string) !== "offered") {
      return { variant: "not_offered", item: input.item };
    }

    // Check authorization: assignee must be in the candidate pool
    let pool: string[];
    try {
      pool = JSON.parse(record.candidate_pool as string);
    } catch {
      pool = [];
    }

    if (pool.length > 0 && !pool.includes(input.assignee)) {
      return { variant: "not_authorized", assignee: input.assignee };
    }

    const now = new Date().toISOString();
    await storage.put("item", input.item, {
      ...record,
      status: "claimed",
      assignee: input.assignee,
      claimed_at: now,
    });

    return { variant: "ok", item: input.item, assignee: input.assignee };
  },

  async start(input, storage) {
    const record = await storage.get("item", input.item);
    if (!record || (record.status as string) !== "claimed") {
      return { variant: "not_claimed", item: input.item };
    }

    await storage.put("item", input.item, {
      ...record,
      status: "active",
    });

    return { variant: "ok", item: input.item };
  },

  async complete(input, storage) {
    const record = await storage.get("item", input.item);
    if (!record || (record.status as string) !== "active") {
      return { variant: "not_active", item: input.item };
    }

    const now = new Date().toISOString();
    await storage.put("item", input.item, {
      ...record,
      status: "completed",
      form_data: input.form_data,
      completed_at: now,
    });

    return {
      variant: "ok",
      item: input.item,
      step_ref: record.step_ref as string,
      form_data: input.form_data,
    };
  },

  async reject(input, storage) {
    const record = await storage.get("item", input.item);
    if (!record) {
      return { variant: "not_active", item: input.item };
    }

    const status = record.status as string;
    if (status !== "active" && status !== "claimed") {
      return { variant: "not_active", item: input.item };
    }

    await storage.put("item", input.item, {
      ...record,
      status: "rejected",
    });

    return {
      variant: "ok",
      item: input.item,
      step_ref: record.step_ref as string,
      reason: input.reason,
    };
  },

  async delegate(input, storage) {
    const record = await storage.get("item", input.item);
    if (!record) {
      return { variant: "not_claimed", item: input.item };
    }

    const status = record.status as string;
    if (status !== "claimed" && status !== "active") {
      return { variant: "not_claimed", item: input.item };
    }

    await storage.put("item", input.item, {
      ...record,
      status: "claimed",
      assignee: input.new_assignee,
    });

    return { variant: "ok", item: input.item, new_assignee: input.new_assignee };
  },

  async release(input, storage) {
    const record = await storage.get("item", input.item);
    if (!record || (record.status as string) !== "claimed") {
      return { variant: "not_claimed", item: input.item };
    }

    await storage.put("item", input.item, {
      ...record,
      status: "offered",
      assignee: null,
      claimed_at: null,
    });

    return { variant: "ok", item: input.item };
  },
};
