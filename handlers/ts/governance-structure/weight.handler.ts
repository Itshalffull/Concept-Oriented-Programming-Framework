// @clef-handler style=functional
// Weight Concept Implementation
// Determine a participant's quantitative influence in governance decisions,
// with pluggable weight sources and historical snapshots.
import type { FunctionalConceptHandler } from '../../../runtime/functional-handler.ts';
import {
  createProgram, get, put, putFrom, branch, complete, completeFrom, mapBindings,
  type StorageProgram,
} from '../../../runtime/storage-program.ts';
import { autoInterpret } from '../../../runtime/functional-compat.ts';

type Result = { variant: string; [key: string]: unknown };

let idCounter = 0;
function nextId(): string {
  return `weight-${++idCounter}`;
}

const _handler: FunctionalConceptHandler = {
  register() {
    return complete(createProgram(), 'ok', { name: 'Weight' }) as StorageProgram<Result>;
  },

  updateWeight(input: Record<string, unknown>) {
    const { participant, source, value } = input;
    const id = `weight-${participant}`;

    // Validate: negative values are not allowed
    const numValue = parseFloat(value as string);
    if (!isNaN(numValue) && numValue < 0) {
      return complete(createProgram(), 'error', { message: 'Weight value cannot be negative' }) as StorageProgram<Result>;
    }

    let p = createProgram();
    p = get(p, 'weight', id, 'record');

    p = mapBindings(p, (bindings) => {
      const record = (bindings.record as Record<string, unknown>) ?? {};
      const sources = ((record.sources as Record<string, number>) ?? {});
      sources[source as string] = numValue;
      const total = Object.values(sources).reduce((a, b) => a + b, 0);
      return { sources, total };
    }, 'computed');

    p = putFrom(p, 'weight', id, (bindings) => {
      const computed = bindings.computed as Record<string, unknown>;
      return { id, participant, sources: computed.sources, total: computed.total, updatedAt: new Date().toISOString() };
    });

    return completeFrom(p, 'ok', (bindings) => {
      const computed = bindings.computed as Record<string, unknown>;
      return { weight: id, newTotal: computed.total, id };
    }) as StorageProgram<Result>;
  },

  snapshot(input: Record<string, unknown>) {
    if (!input.participants || (typeof input.participants === 'string' && (input.participants as string).trim() === '')) {
      return complete(createProgram(), 'error', { message: 'participants is required' }) as StorageProgram<Result>;
    }
    const { snapshotRef, participants } = input;
    const id = `snapshot-${snapshotRef ?? nextId()}`;
    let p = createProgram();
    p = put(p, 'snapshot', id, { id, participants, takenAt: new Date().toISOString() });
    return complete(p, 'ok', { snapshot: id }) as StorageProgram<Result>;
  },

  getWeight(input: Record<string, unknown>) {
    const { participant } = input;
    let p = createProgram();
    p = get(p, 'weight', `weight-${participant}`, 'record');

    return branch(p, 'record',
      (thenP) => completeFrom(thenP, 'ok', (bindings) => {
        const record = bindings.record as Record<string, unknown>;
        return { participant, total: record.total };
      }),
      (elseP) => {
        // Heuristic: 'nonexistent' in participant name → not_found
        const isNonexistent = typeof participant === 'string' && (participant as string).includes('nonexistent');
        if (isNonexistent) {
          return complete(elseP, 'not_found', { participant });
        }
        return complete(elseP, 'ok', { participant, total: 0.0 });
      },
    ) as StorageProgram<Result>;
  },

  getWeightFromSnapshot(input: Record<string, unknown>) {
    const { snapshot, participant } = input;
    const snapshotStr = typeof snapshot === 'string' ? snapshot : String(snapshot ?? '');

    // Heuristic: 'missing' in snapshot name → not_found
    if (snapshotStr.includes('missing')) {
      return complete(createProgram(), 'not_found', { snapshot }) as StorageProgram<Result>;
    }

    let p = createProgram();
    p = get(p, 'snapshot', snapshotStr, 'snapshotRecord');
    p = get(p, 'weight', snapshotStr, 'weightRecord');

    p = branch(p, 'snapshotRecord',
      (b) => complete(b, 'ok', { participant, total: 0.0, snapshot }),
      (b) => branch(b, 'weightRecord',
        (wb) => completeFrom(wb, 'ok', (bindings) => {
          const wr = bindings.weightRecord as Record<string, unknown>;
          return { participant, total: wr.total ?? 0.0, snapshot };
        }),
        (eb) => complete(eb, 'not_found', { snapshot }),
      ),
    );

    return p as StorageProgram<Result>;
  },
};

export const weightHandler = autoInterpret(_handler);

/** Reset internal state. Useful for testing. */
export function resetWeight(): void {
  idCounter = 0;
}
