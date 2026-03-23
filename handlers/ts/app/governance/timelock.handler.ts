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
    if (!input.operationHash || (typeof input.operationHash === 'string' && (input.operationHash as string).trim() === '')) {
      return complete(createProgram(), 'error', { message: 'operationHash is required' }) as StorageProgram<Result>;
    }
    const id = `timelock-${Date.now()}`;
    const delayHours = parseFloat(input.delayHours as string) || 0;
    const gracePeriodHours = parseFloat(input.gracePeriodHours as string) || 0;
    const eta = new Date(Date.now() + delayHours * 3600000).toISOString();
    const grace = new Date(Date.now() + (delayHours + gracePeriodHours) * 3600000).toISOString();
    let p = createProgram();
    p = put(p, 'timelock', id, {
      id, operationHash: input.operationHash, payload: input.payload,
      delayHours: input.delayHours, gracePeriodHours: input.gracePeriodHours,
      eta, graceEnd: grace, status: 'Queued', queuedAt: new Date().toISOString(),
    });
    return complete(p, 'ok', { id, lock: id }) as StorageProgram<Result>;
  },

  execute(input: Record<string, unknown>) {
    const { lock } = input;
    if (!lock) {
      return complete(createProgram(), 'not_found', { lock }) as StorageProgram<Result>;
    }
    let p = createProgram();
    p = get(p, 'timelock', lock as string, 'record');

    p = branch(p, 'record',
      (b) => {
        let b2 = put(b, 'timelock', lock as string, { status: 'Executed', executedAt: new Date().toISOString() });
        return complete(b2, 'ok', { lock });
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
        return complete(b2, 'ok', { lock });
      },
      (b) => complete(b, 'not_found', { lock }),
    );

    return p as StorageProgram<Result>;
  },
};

export const timelockHandler = autoInterpret(_timelockHandler);
