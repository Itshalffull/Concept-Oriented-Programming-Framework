// @clef-handler style=functional
// ============================================================
// WorkItem Handler
//
// Manages the lifecycle of human tasks: offering to candidate
// pools, claiming by individuals, completing with form data,
// delegating, and releasing. See process-human suite.
// ============================================================

import type { FunctionalConceptHandler } from '../../../runtime/functional-handler.ts';
import {
  createProgram, get, put, putFrom, find, branch, complete, completeFrom,
  mapBindings,
  type StorageProgram,
} from '../../../runtime/storage-program.ts';
import { autoInterpret } from '../../../runtime/functional-compat.ts';

type Result = { variant: string; [key: string]: unknown };

let idCounter = 0;
function nextId(): string {
  return `wi-${++idCounter}`;
}

const _handler: FunctionalConceptHandler = {

  register() {
    return complete(createProgram(), 'ok', { name: 'WorkItem' });
  },

  // action create(step_ref: String, candidate_pool: Bytes, form_schema: String, priority: Int)
  //   -> ok(item: W, step_ref: String)
  create(input: Record<string, unknown>) {
    const stepRef = input.step_ref as string;
    const candidatePool = input.candidate_pool as string;
    const formSchema = input.form_schema as string;
    const priority = input.priority as number;

    if (!stepRef || stepRef.trim() === '') {
      return complete(createProgram(), 'error', { message: 'step_ref is required' });
    }

    const id = nextId();
    const now = new Date().toISOString();

    let parsedPool: string[] = [];
    try {
      parsedPool = JSON.parse(candidatePool) as string[];
    } catch {
      parsedPool = [candidatePool];
    }

    let p = createProgram();
    p = put(p, 'work_item', id, {
      id,
      step_ref: stepRef,
      status: 'offered',
      assignee: null,
      candidate_pool: parsedPool,
      form_schema: formSchema || null,
      form_data: null,
      priority: priority ?? 0,
      due_at: null,
      claimed_at: null,
      completed_at: null,
      created_at: now,
    });
    return complete(p, 'ok', { item: id, step_ref: stepRef });
  },

  // action claim(item: W, assignee: String)
  //   -> ok(item: W, assignee: String)   — success
  //   -> ok(item: W)                     — not in offered status
  //   -> ok(assignee: String)            — assignee not in candidate pool
  claim(input: Record<string, unknown>) {
    const itemId = input.item as string;
    const assignee = input.assignee as string;

    if (!assignee || assignee.trim() === '') {
      return complete(createProgram(), 'error', { message: 'assignee is required' });
    }

    let p = createProgram();
    p = get(p, 'work_item', itemId, 'existing');

    return branch(p,
      (bindings) => !bindings.existing,
      complete(createProgram(), 'not_found', { message: 'Work item not found' }),
      (() => {
        let b = createProgram();
        b = get(b, 'work_item', itemId, 'existing');
        // Check status is 'offered'
        return branch(b,
          (bindings) => {
            const rec = bindings.existing as Record<string, unknown>;
            return rec.status !== 'offered';
          },
          // Not in offered status
          completeFrom(createProgram(), 'ok', () => ({ item: itemId })),
          (() => {
            // Check assignee is in candidate pool
            let c = createProgram();
            c = get(c, 'work_item', itemId, 'existing');
            return branch(c,
              (bindings) => {
                const rec = bindings.existing as Record<string, unknown>;
                const pool = rec.candidate_pool as string[];
                return !pool.includes(assignee);
              },
              // Assignee not in pool
              completeFrom(createProgram(), 'ok', () => ({ assignee })),
              (() => {
                // Success: claim the item
                let d = createProgram();
                d = get(d, 'work_item', itemId, 'existing');
                d = putFrom(d, 'work_item', itemId, (bindings) => {
                  const rec = bindings.existing as Record<string, unknown>;
                  return {
                    ...rec,
                    status: 'claimed',
                    assignee,
                    claimed_at: new Date().toISOString(),
                  };
                });
                return complete(d, 'ok', { item: itemId, assignee });
              })(),
            );
          })(),
        );
      })(),
    );
  },

  // action start(item: W)
  //   -> ok(item: W)  — success (claimed -> active)
  //   -> ok(item: W)  — not in claimed status
  start(input: Record<string, unknown>) {
    const itemId = input.item as string;

    let p = createProgram();
    p = get(p, 'work_item', itemId, 'existing');

    return branch(p,
      (bindings) => !bindings.existing,
      complete(createProgram(), 'not_found', { message: 'Work item not found' }),
      (() => {
        let b = createProgram();
        b = get(b, 'work_item', itemId, 'existing');
        return branch(b,
          (bindings) => {
            const rec = bindings.existing as Record<string, unknown>;
            return rec.status !== 'claimed';
          },
          // Not in claimed status
          completeFrom(createProgram(), 'ok', () => ({ item: itemId })),
          (() => {
            let c = createProgram();
            c = get(c, 'work_item', itemId, 'existing');
            c = putFrom(c, 'work_item', itemId, (bindings) => {
              const rec = bindings.existing as Record<string, unknown>;
              return { ...rec, status: 'active' };
            });
            return complete(c, 'ok', { item: itemId });
          })(),
        );
      })(),
    );
  },

  // action complete(item: W, form_data: Bytes)
  //   -> ok(item: W, step_ref: String, form_data: Bytes) — success
  //   -> ok(item: W)                                     — not in active status
  //   -> ok(message: String)                             — form data invalid
  complete(input: Record<string, unknown>) {
    const itemId = input.item as string;
    const formData = input.form_data as string;

    let p = createProgram();
    p = get(p, 'work_item', itemId, 'existing');

    return branch(p,
      (bindings) => !bindings.existing,
      complete(createProgram(), 'not_found', { message: 'Work item not found' }),
      (() => {
        let b = createProgram();
        b = get(b, 'work_item', itemId, 'existing');
        return branch(b,
          (bindings) => {
            const rec = bindings.existing as Record<string, unknown>;
            return rec.status !== 'active';
          },
          // Not in active status
          completeFrom(createProgram(), 'ok', () => ({ item: itemId })),
          (() => {
            let c = createProgram();
            c = get(c, 'work_item', itemId, 'existing');
            const now = new Date().toISOString();
            c = putFrom(c, 'work_item', itemId, (bindings) => {
              const rec = bindings.existing as Record<string, unknown>;
              return {
                ...rec,
                status: 'completed',
                form_data: formData,
                completed_at: now,
              };
            });
            return completeFrom(c, 'ok', (bindings) => {
              const rec = bindings.existing as Record<string, unknown>;
              return {
                item: itemId,
                step_ref: rec.step_ref as string,
                form_data: formData,
              };
            });
          })(),
        );
      })(),
    );
  },

  // action reject(item: W, reason: String)
  //   -> ok(item: W, step_ref: String, reason: String) — success
  //   -> ok(item: W)                                   — not in active/claimed status
  reject(input: Record<string, unknown>) {
    const itemId = input.item as string;
    const reason = input.reason as string;

    let p = createProgram();
    p = get(p, 'work_item', itemId, 'existing');

    return branch(p,
      (bindings) => !bindings.existing,
      complete(createProgram(), 'not_found', { message: 'Work item not found' }),
      (() => {
        let b = createProgram();
        b = get(b, 'work_item', itemId, 'existing');
        return branch(b,
          (bindings) => {
            const rec = bindings.existing as Record<string, unknown>;
            return rec.status !== 'active' && rec.status !== 'claimed';
          },
          // Not in active or claimed status
          completeFrom(createProgram(), 'ok', () => ({ item: itemId })),
          (() => {
            let c = createProgram();
            c = get(c, 'work_item', itemId, 'existing');
            c = putFrom(c, 'work_item', itemId, (bindings) => {
              const rec = bindings.existing as Record<string, unknown>;
              return { ...rec, status: 'rejected' };
            });
            return completeFrom(c, 'ok', (bindings) => {
              const rec = bindings.existing as Record<string, unknown>;
              return {
                item: itemId,
                step_ref: rec.step_ref as string,
                reason,
              };
            });
          })(),
        );
      })(),
    );
  },

  // action delegate(item: W, new_assignee: String)
  //   -> ok(item: W, new_assignee: String) — success
  //   -> ok(item: W)                       — not in claimed/active status
  delegate(input: Record<string, unknown>) {
    const itemId = input.item as string;
    const newAssignee = input.new_assignee as string;

    let p = createProgram();
    p = get(p, 'work_item', itemId, 'existing');

    return branch(p,
      (bindings) => !bindings.existing,
      complete(createProgram(), 'not_found', { message: 'Work item not found' }),
      (() => {
        let b = createProgram();
        b = get(b, 'work_item', itemId, 'existing');
        return branch(b,
          (bindings) => {
            const rec = bindings.existing as Record<string, unknown>;
            return rec.status !== 'claimed' && rec.status !== 'active';
          },
          // Not in claimed or active status
          completeFrom(createProgram(), 'ok', () => ({ item: itemId })),
          (() => {
            let c = createProgram();
            c = get(c, 'work_item', itemId, 'existing');
            c = putFrom(c, 'work_item', itemId, (bindings) => {
              const rec = bindings.existing as Record<string, unknown>;
              return { ...rec, assignee: newAssignee, status: 'delegated' };
            });
            return complete(c, 'ok', { item: itemId, new_assignee: newAssignee });
          })(),
        );
      })(),
    );
  },

  // action release(item: W)
  //   -> ok(item: W) — success (back to offered)
  //   -> ok(item: W) — not in claimed status
  release(input: Record<string, unknown>) {
    const itemId = input.item as string;

    let p = createProgram();
    p = get(p, 'work_item', itemId, 'existing');

    return branch(p,
      (bindings) => !bindings.existing,
      complete(createProgram(), 'not_found', { message: 'Work item not found' }),
      (() => {
        let b = createProgram();
        b = get(b, 'work_item', itemId, 'existing');
        return branch(b,
          (bindings) => {
            const rec = bindings.existing as Record<string, unknown>;
            return rec.status !== 'claimed';
          },
          // Not in claimed status
          completeFrom(createProgram(), 'ok', () => ({ item: itemId })),
          (() => {
            let c = createProgram();
            c = get(c, 'work_item', itemId, 'existing');
            c = putFrom(c, 'work_item', itemId, (bindings) => {
              const rec = bindings.existing as Record<string, unknown>;
              return { ...rec, status: 'offered', assignee: null, claimed_at: null };
            });
            return complete(c, 'ok', { item: itemId });
          })(),
        );
      })(),
    );
  },
  list(input: Record<string, unknown>) {
    const assignee = input.assignee as string | undefined;
    const processRef = input.process_ref as string | undefined;
    const status = input.status as string | undefined;
    let p = createProgram();
    p = find(p, 'work_item', {}, '_allItems');
    return completeFrom(p, 'ok', (bindings) => {
      const all = (bindings._allItems as Array<Record<string, unknown>>) ?? [];
      let items = all;
      if (assignee) {
        items = items.filter((rec) => rec.assignee === assignee);
      }
      if (processRef) {
        items = items.filter((rec) => rec.process_ref === processRef);
      }
      if (status) {
        items = items.filter((rec) => rec.status === status);
      }
      return { items };
    }) as StorageProgram<Result>;
  },
};

export const workItemHandler = autoInterpret(_handler);
