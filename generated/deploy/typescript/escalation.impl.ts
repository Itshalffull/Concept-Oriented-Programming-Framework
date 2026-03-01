// generated: escalation.impl.ts
import type { ConceptStorage } from "@clef/runtime";
import type { EscalationHandler } from "./escalation.handler";

async function nextId(storage: ConceptStorage): Promise<string> {
  const counter = await storage.get("_idCounter", "_escalation");
  const next = counter ? (counter.value as number) + 1 : 1;
  await storage.put("_idCounter", "_escalation", { value: next });
  return `esc-${String(next).padStart(6, "0")}`;
}

export const escalationHandler: EscalationHandler = {
  async escalate(input, storage) {
    const escalation = await nextId(storage);
    const now = new Date().toISOString();

    await storage.put("escalation", escalation, {
      id: escalation,
      source_ref: input.source_ref,
      run_ref: input.run_ref,
      status: "escalated",
      trigger_type: input.trigger_type,
      target: null,
      level: input.level,
      reason: input.reason,
      acceptor: null,
      created_at: now,
      resolved_at: null,
    });

    return { variant: "ok", escalation, source_ref: input.source_ref };
  },

  async accept(input, storage) {
    const record = await storage.get("escalation", input.escalation);
    if (!record || (record.status as string) !== "escalated") {
      return { variant: "not_escalated", escalation: input.escalation };
    }

    await storage.put("escalation", input.escalation, {
      ...record,
      status: "accepted",
      acceptor: input.acceptor,
      target: input.acceptor,
    });

    return { variant: "ok", escalation: input.escalation };
  },

  async resolve(input, storage) {
    const record = await storage.get("escalation", input.escalation);
    if (!record || (record.status as string) !== "accepted") {
      return { variant: "not_accepted", escalation: input.escalation };
    }

    const now = new Date().toISOString();
    await storage.put("escalation", input.escalation, {
      ...record,
      status: "resolved",
      resolved_at: now,
    });

    return {
      variant: "ok",
      escalation: input.escalation,
      source_ref: record.source_ref as string,
      resolution: input.resolution,
    };
  },

  async reEscalate(input, storage) {
    const record = await storage.get("escalation", input.escalation);
    if (!record) {
      return { variant: "ok", escalation: input.escalation };
    }

    await storage.put("escalation", input.escalation, {
      ...record,
      status: "escalated",
      level: input.new_level,
      reason: input.reason,
      acceptor: null,
      target: null,
    });

    return { variant: "ok", escalation: input.escalation };
  },
};
