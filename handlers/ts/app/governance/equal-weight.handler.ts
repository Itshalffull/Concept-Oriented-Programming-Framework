// @clef-handler style=functional
// @migrated dsl-constructs 2026-03-18
// EqualWeight Source Provider
// Returns a fixed weight per participant regardless of holdings or reputation.
import type { FunctionalConceptHandler } from '../../../../runtime/functional-handler.ts';
import {
  createProgram, get, put, complete, completeFrom,
  type StorageProgram,
} from '../../../../runtime/storage-program.ts';
import { autoInterpret } from '../../../../runtime/functional-compat.ts';

type Result = { variant: string; [key: string]: unknown };

const _equalWeightHandler: FunctionalConceptHandler = {
  configure(input: Record<string, unknown>) {
    const id = `ew-cfg-${Date.now()}`;
    let p = createProgram();
    p = put(p, 'ew_cfg', id, {
      id,
      weightPerPerson: input.weightPerPerson ?? 1.0,
    });
    p = put(p, 'plugin-registry', `weight-source:${id}`, {
      id: `weight-source:${id}`,
      pluginKind: 'weight-source',
      provider: 'EqualWeight',
      instanceId: id,
    });
    return complete(p, 'ok', { id, config: id }) as StorageProgram<Result>;
  },

  getWeight(input: Record<string, unknown>) {
    if (!input.participant || (typeof input.participant === 'string' && (input.participant as string).trim() === '')) {
      return complete(createProgram(), 'error', { message: 'participant is required' }) as StorageProgram<Result>;
    }
    const { config, participant } = input;
    let p = createProgram();
    p = get(p, 'ew_cfg', config as string, 'record');

    return completeFrom(p, 'ok', (bindings) => {
      const record = bindings.record as Record<string, unknown> | null;
      const weight = record ? (record.weightPerPerson as number) : 1.0;
      return { participant, weight };
    }) as StorageProgram<Result>;
  },
};

export const equalWeightHandler = autoInterpret(_equalWeightHandler);
