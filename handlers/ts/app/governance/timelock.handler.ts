// @clef-handler style=functional
// @migrated dsl-constructs 2026-03-18
// Timelock Concept Handler
// Safety delay between governance decision and execution — @gate concept.
import type { FunctionalConceptHandler } from '../../../../runtime/functional-handler.ts';
import {
  createProgram, get, put, branch, complete, completeFrom,
  type StorageProgram,
} from '../../../../runtime/storage-program.ts';
import { autoInterpret } from '../../../../runtime/functional-compat.ts';

type Result = { variant: string; [key: string]: unknown };

const _timelockHandler: FunctionalConceptHandler = {
  schedule(input: Record<string, unknown>) {
    const id = `timelock-${Date.now()}`;
    const eta = new Date(Date.now() + (input.delayHours as number) * 3600000).toISOString();
    const grace = new Date(Date.now() + ((input.delayHours as number) + (input.gracePeriodHours as number)) * 3600000).toISOString();
    let p = createProgram();
    p = put(p, 'timelock', id, {
      id, operationHash: input.operationHash, payload: input.payload,
      delayHours: input.delayHours, gracePeriodHours: input.gracePeriodHours,
      eta, graceEnd: grace, status: 'Queued', queuedAt: new Date().toISOString(),
    });
    return complete(p, 'queued', { lock: id }) as StorageProgram<Result>;
  },

  execute(input: Record<string, unknown>) {
    const { lock } = input;
    let p = createProgram();
    p = get(p, 'timelock', lock as string, 'record');

    p = branch(p, 'record',
      (b) => {
        return completeFrom(b, 'executed', (bindings) => {
          const record = bindings.record as Record<string, unknown>;
          if (new Date() < new Date(record.eta as string)) {
            return { variant: 'not_ready', lock, eta: record.eta };
          }
          return { variant: 'executed', lock, payload: record.payload };
        });
      },
      (b) => complete(b, 'not_found', { lock }),
    );

    return p as StorageProgram<Result>;
  },

  cancel(input: Record<string, unknown>) {
    const { lock, reason } = input;
    let p = createProgram();
    p = get(p, 'timelock', lock as string, 'record');

    p = branch(p, 'record',
      (b) => {
        let b2 = put(b, 'timelock', lock as string, { status: 'Cancelled', cancelReason: reason });
        return complete(b2, 'cancelled', { lock });
      },
      (b) => complete(b, 'not_found', { lock }),
    );

    return p as StorageProgram<Result>;
  },
};

export const timelockHandler = autoInterpret(_timelockHandler);
