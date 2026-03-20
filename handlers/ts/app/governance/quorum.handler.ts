// @clef-handler style=functional
// @migrated dsl-constructs 2026-03-18
// Quorum Concept Handler
// Minimum participation threshold for decision validity.
import type { FunctionalConceptHandler } from '../../../../runtime/functional-handler.ts';
import {
  createProgram, get, put, branch, complete, completeFrom,
  type StorageProgram,
} from '../../../../runtime/storage-program.ts';
import { autoInterpret } from '../../../../runtime/functional-compat.ts';

type Result = { variant: string; [key: string]: unknown };

const _quorumHandler: FunctionalConceptHandler = {
  setThreshold(input: Record<string, unknown>) {
    const id = `quorum-${Date.now()}`;
    let p = createProgram();
    p = put(p, 'quorum', id, {
      id, type: input.type, absoluteThreshold: input.absoluteThreshold ?? null,
      fractionalThreshold: input.fractionalThreshold ?? null, scope: input.scope,
    });
    return complete(p, 'set', { quorum: id }) as StorageProgram<Result>;
  },

  check(input: Record<string, unknown>) {
    const { quorum, participation, total } = input;
    let p = createProgram();
    p = get(p, 'quorum', quorum as string, 'record');

    p = branch(p, 'record',
      (b) => {
        return completeFrom(b, 'met', (bindings) => {
          const record = bindings.record as Record<string, unknown>;
          const pVal = participation as number;
          const t = total as number;
          if (record.type === 'None') return { variant: 'met', quorum, participation: pVal };
          if (record.type === 'Absolute' && pVal >= (record.absoluteThreshold as number)) {
            return { variant: 'met', quorum, participation: pVal };
          }
          if (record.type === 'Fractional' && pVal / t >= (record.fractionalThreshold as number)) {
            return { variant: 'met', quorum, participation: pVal };
          }
          return { variant: 'not_met', quorum, participation: pVal, required: record.absoluteThreshold ?? record.fractionalThreshold };
        });
      },
      (b) => complete(b, 'not_found', { quorum }),
    );

    return p as StorageProgram<Result>;
  },

  updateThreshold(input: Record<string, unknown>) {
    const { quorum } = input;
    let p = createProgram();
    p = get(p, 'quorum', quorum as string, 'record');

    p = branch(p, 'record',
      (b) => {
        let b2 = put(b, 'quorum', quorum as string, { ...input });
        return complete(b2, 'updated', { quorum });
      },
      (b) => complete(b, 'not_found', { quorum }),
    );

    return p as StorageProgram<Result>;
  },
};

export const quorumHandler = autoInterpret(_quorumHandler);
