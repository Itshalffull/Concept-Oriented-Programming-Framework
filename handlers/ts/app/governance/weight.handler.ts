// @clef-handler style=functional
// @migrated dsl-constructs 2026-03-18
// Weight Concept Handler
// Coordination concept routing to pluggable weight source providers.
import type { FunctionalConceptHandler } from '../../../../runtime/functional-handler.ts';
import {
  createProgram, get, put, putFrom, branch, complete, completeFrom, mapBindings,
  type StorageProgram,
} from '../../../../runtime/storage-program.ts';
import { autoInterpret } from '../../../../runtime/functional-compat.ts';

type Result = { variant: string; [key: string]: unknown };

const _weightHandler: FunctionalConceptHandler = {
  updateWeight(input: Record<string, unknown>) {
    const { participant, source, value } = input;
    const id = `weight-${participant}`;
    let p = createProgram();
    p = get(p, 'weight', id, 'record');

    p = mapBindings(p, (bindings) => {
      const record = (bindings.record as Record<string, unknown>) ?? {};
      const sources = ((record.sources as Record<string, number>) ?? {});
      sources[source as string] = value as number;
      const total = Object.values(sources).reduce((a, b) => a + b, 0);
      return { sources, total };
    }, 'computed');

    p = putFrom(p, 'weight', id, (bindings) => {
      const computed = bindings.computed as Record<string, unknown>;
      return { id, participant, sources: computed.sources, total: computed.total, updatedAt: new Date().toISOString() };
    });

    return completeFrom(p, 'updated', (bindings) => {
      const computed = bindings.computed as Record<string, unknown>;
      return { weight: id, newTotal: computed.total };
    }) as StorageProgram<Result>;
  },

  snapshot(input: Record<string, unknown>) {
    const { snapshotRef, participants } = input;
    const id = `snapshot-${snapshotRef ?? Date.now()}`;
    let p = createProgram();
    p = put(p, 'snapshot', id, { id, participants, takenAt: new Date().toISOString() });
    return complete(p, 'snapped', { snapshot: id }) as StorageProgram<Result>;
  },

  getWeight(input: Record<string, unknown>) {
    const { participant } = input;
    let p = createProgram();
    p = get(p, 'weight', `weight-${participant}`, 'record');

    return completeFrom(p, 'weight', (bindings) => {
      const record = bindings.record as Record<string, unknown> | null;
      if (!record) return { participant, total: 0.0 };
      return { participant, total: record.total };
    }) as StorageProgram<Result>;
  },

  getWeightFromSnapshot(input: Record<string, unknown>) {
    const { snapshot, participant } = input;
    let p = createProgram();
    p = get(p, 'snapshot', snapshot as string, 'record');

    p = branch(p, 'record',
      (b) => complete(b, 'weight', { participant, total: 0.0, snapshot }),
      (b) => complete(b, 'not_found', { snapshot }),
    );

    return p as StorageProgram<Result>;
  },
};

export const weightHandler = autoInterpret(_weightHandler);
