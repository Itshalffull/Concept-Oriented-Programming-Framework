// generated: processevent.impl.ts
import type { ConceptStorage } from "@clef/runtime";
import type { ProcessEventHandler } from "./processevent.handler";

async function nextId(storage: ConceptStorage): Promise<string> {
  const counter = await storage.get("_idCounter", "_processevent");
  const next = counter ? (counter.value as number) + 1 : 1;
  await storage.put("_idCounter", "_processevent", { value: next });
  return `evt-${String(next).padStart(6, "0")}`;
}

/** Get the next sequence number for a given run (monotonically increasing per run). */
async function nextSeq(storage: ConceptStorage, runRef: string): Promise<number> {
  const cursor = await storage.get("cursor", runRef);
  const next = cursor ? (cursor.last_seq as number) + 1 : 1;
  await storage.put("cursor", runRef, { last_seq: next });
  return next;
}

/** Retrieve the event ID index for a run. */
async function getEventIndex(storage: ConceptStorage, runRef: string): Promise<string[]> {
  const index = await storage.get("eventIndex", runRef);
  if (!index) return [];
  return JSON.parse(index.ids as string);
}

async function putEventIndex(storage: ConceptStorage, runRef: string, ids: string[]): Promise<void> {
  await storage.put("eventIndex", runRef, { ids: JSON.stringify(ids) });
}

export const processEventHandler: ProcessEventHandler = {
  async append(input, storage) {
    const event = await nextId(storage);
    const seq = await nextSeq(storage, input.run_ref);
    const now = new Date().toISOString();

    // Extract optional step_ref and actor_ref from payload metadata
    let stepRef: string | null = null;
    let actorRef: string | null = null;
    try {
      const parsed = JSON.parse(input.payload);
      if (parsed.step_ref) stepRef = parsed.step_ref;
      if (parsed.actor_ref) actorRef = parsed.actor_ref;
    } catch {
      // payload may not be JSON - that's fine
    }

    await storage.put("event", event, {
      id: event,
      run_ref: input.run_ref,
      event_type: input.event_type,
      step_ref: stepRef,
      actor_ref: actorRef,
      payload: input.payload,
      timestamp: now,
      sequence_num: seq,
    });

    // Add to run's event index
    const ids = await getEventIndex(storage, input.run_ref);
    ids.push(event);
    await putEventIndex(storage, input.run_ref, ids);

    return { variant: "ok", event, sequence_num: seq };
  },

  async query(input, storage) {
    const ids = await getEventIndex(storage, input.run_ref);
    const events: Array<{
      event: string;
      event_type: string;
      payload: string;
      sequence_num: number;
      timestamp: string;
    }> = [];

    for (const id of ids) {
      const record = await storage.get("event", id);
      if (record && (record.sequence_num as number) > input.after_seq) {
        events.push({
          event: id,
          event_type: record.event_type as string,
          payload: record.payload as string,
          sequence_num: record.sequence_num as number,
          timestamp: record.timestamp as string,
        });
        if (events.length >= input.limit) break;
      }
    }

    // Sort by sequence_num ascending
    events.sort((a, b) => a.sequence_num - b.sequence_num);

    return { variant: "ok", events: JSON.stringify(events), count: events.length };
  },

  async queryByType(input, storage) {
    const ids = await getEventIndex(storage, input.run_ref);
    const events: Array<{
      event: string;
      event_type: string;
      payload: string;
      sequence_num: number;
      timestamp: string;
    }> = [];

    for (const id of ids) {
      const record = await storage.get("event", id);
      if (record && (record.event_type as string) === input.event_type) {
        events.push({
          event: id,
          event_type: record.event_type as string,
          payload: record.payload as string,
          sequence_num: record.sequence_num as number,
          timestamp: record.timestamp as string,
        });
        if (events.length >= input.limit) break;
      }
    }

    events.sort((a, b) => a.sequence_num - b.sequence_num);

    return { variant: "ok", events: JSON.stringify(events), count: events.length };
  },

  async getCursor(input, storage) {
    const cursor = await storage.get("cursor", input.run_ref);
    const lastSeq = cursor ? (cursor.last_seq as number) : 0;
    return { variant: "ok", last_seq: lastSeq };
  },
};
