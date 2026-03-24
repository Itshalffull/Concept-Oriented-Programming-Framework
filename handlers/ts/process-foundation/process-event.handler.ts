// @clef-handler style=functional
// ProcessEvent Concept Implementation
// Append-only event stream recording everything that happens in a process run.
// Serves as the source of truth for audit trails, process mining, replay, and observability.
import type { FunctionalConceptHandler } from '../../../runtime/functional-handler.ts';
import {
  createProgram, get, put, find, branch, complete, completeFrom, putFrom,
  mapBindings,
  type StorageProgram,
} from '../../../runtime/storage-program.ts';
import { autoInterpret } from '../../../runtime/functional-compat.ts';

type Result = { variant: string; [key: string]: unknown };

let idCounter = 0;
function nextId(): string {
  return `pevt-${Date.now()}-${++idCounter}`;
}

const _handler: FunctionalConceptHandler = {
  register(_input: Record<string, unknown>) {
    let p = createProgram();
    p = get(p, 'process-event', '__registered', 'existing');
    return branch(p, 'existing',
      (b) => complete(b, 'already_registered', { name: 'ProcessEvent' }),
      (b) => {
        let b2 = put(b, 'process-event', '__registered', { value: true });
        return complete(b2, 'ok', { name: 'ProcessEvent' });
      },
    ) as StorageProgram<Result>;
  },

  append(input: Record<string, unknown>) {
    const runRef = input.run_ref as string;
    const eventType = input.event_type as string;
    const payload = input.payload as string;

    if (!runRef || runRef.trim() === '') {
      return complete(createProgram(), 'error', { message: 'run_ref is required' }) as StorageProgram<Result>;
    }

    const id = nextId();
    const now = new Date().toISOString();

    // Get or create the cursor for this run to determine sequence number
    const cursorKey = `cursor:${runRef}`;
    let p = createProgram();
    p = get(p, 'process-event-cursor', cursorKey, 'cursor');

    return branch(p, 'cursor',
      (b) => {
        // Cursor exists - increment sequence
        let b2 = putFrom(b, 'process-event-cursor', cursorKey, (bindings) => {
          const cur = bindings.cursor as Record<string, unknown>;
          const lastSeq = cur.last_seq as number;
          return { run_ref: runRef, last_seq: lastSeq + 1 };
        });
        // Extract optional fields from payload
        let stepRef: string | null = null;
        let actorRef: string | null = null;
        try {
          const payloadObj = JSON.parse(payload);
          stepRef = (payloadObj.step_ref as string) || null;
          actorRef = (payloadObj.actor_ref as string) || null;
        } catch {
          // payload may not be JSON, that's ok
        }
        b2 = putFrom(b2, 'process-event', id, (bindings) => {
          const cur = bindings.cursor as Record<string, unknown>;
          const seqNum = (cur.last_seq as number) + 1;
          return {
            id,
            run_ref: runRef,
            event_type: eventType,
            step_ref: stepRef,
            actor_ref: actorRef,
            payload,
            timestamp: now,
            sequence_num: seqNum,
          };
        });
        return completeFrom(b2, 'ok', (bindings) => {
          const cur = bindings.cursor as Record<string, unknown>;
          const seqNum = (cur.last_seq as number) + 1;
          return { event: id, sequence_num: seqNum };
        });
      },
      (b) => {
        // No cursor yet - first event for this run, seq = 1
        let b2 = put(b, 'process-event-cursor', cursorKey, {
          run_ref: runRef,
          last_seq: 1,
        });
        let stepRef: string | null = null;
        let actorRef: string | null = null;
        try {
          const payloadObj = JSON.parse(payload);
          stepRef = (payloadObj.step_ref as string) || null;
          actorRef = (payloadObj.actor_ref as string) || null;
        } catch {
          // payload may not be JSON
        }
        b2 = put(b2, 'process-event', id, {
          id,
          run_ref: runRef,
          event_type: eventType,
          step_ref: stepRef,
          actor_ref: actorRef,
          payload,
          timestamp: now,
          sequence_num: 1,
        });
        return complete(b2, 'ok', { event: id, sequence_num: 1 });
      },
    ) as StorageProgram<Result>;
  },

  query(input: Record<string, unknown>) {
    const runRef = input.run_ref as string;
    const afterSeq = input.after_seq as number;
    const limit = input.limit as number;

    if (!runRef || runRef.trim() === '') {
      return complete(createProgram(), 'error', { message: 'run_ref is required' }) as StorageProgram<Result>;
    }

    let p = createProgram();
    p = find(p, 'process-event', { run_ref: runRef }, 'allEvents');
    return completeFrom(p, 'ok', (bindings) => {
      const events = (bindings.allEvents as Array<Record<string, unknown>>) || [];
      const filtered = events
        .filter((e) => (e.sequence_num as number) > afterSeq)
        .sort((a, b) => (a.sequence_num as number) - (b.sequence_num as number))
        .slice(0, limit);
      return {
        events: JSON.stringify(filtered),
        count: filtered.length,
      };
    }) as StorageProgram<Result>;
  },

  query_by_type(input: Record<string, unknown>) {
    const runRef = input.run_ref as string;
    const eventType = input.event_type as string;
    const limit = input.limit as number;

    if (!runRef || runRef.trim() === '') {
      return complete(createProgram(), 'error', { message: 'run_ref is required' }) as StorageProgram<Result>;
    }

    let p = createProgram();
    p = find(p, 'process-event', { run_ref: runRef, event_type: eventType }, 'matchedEvents');
    return completeFrom(p, 'ok', (bindings) => {
      const events = (bindings.matchedEvents as Array<Record<string, unknown>>) || [];
      const sorted = events
        .sort((a, b) => (a.sequence_num as number) - (b.sequence_num as number))
        .slice(0, limit);
      return {
        events: JSON.stringify(sorted),
        count: sorted.length,
      };
    }) as StorageProgram<Result>;
  },

  get_cursor(input: Record<string, unknown>) {
    const runRef = input.run_ref as string;

    if (!runRef || runRef.trim() === '') {
      return complete(createProgram(), 'error', { message: 'run_ref is required' }) as StorageProgram<Result>;
    }

    const cursorKey = `cursor:${runRef}`;
    let p = createProgram();
    p = get(p, 'process-event-cursor', cursorKey, 'cursor');
    return completeFrom(p, 'ok', (bindings) => {
      const cur = bindings.cursor as Record<string, unknown> | null;
      return { last_seq: cur ? (cur.last_seq as number) : 0 };
    }) as StorageProgram<Result>;
  },
};

export const processEventHandler = autoInterpret(_handler);
