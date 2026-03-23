// @clef-handler style=functional
// @migrated dsl-constructs 2026-03-18
// Monitor Concept Handler
// Compliance assessment (Ostrom DP4).
import type { FunctionalConceptHandler } from '../../../../runtime/functional-handler.ts';
import {
  createProgram, get, put, branch, complete,
  type StorageProgram,
} from '../../../../runtime/storage-program.ts';
import { autoInterpret } from '../../../../runtime/functional-compat.ts';

type Result = { variant: string; [key: string]: unknown };

const _monitorHandler: FunctionalConceptHandler = {
  watch(input: Record<string, unknown>) {
    if (!input.subject || (typeof input.subject === 'string' && (input.subject as string).trim() === '')) {
      return complete(createProgram(), 'error', { message: 'subject is required' }) as StorageProgram<Result>;
    }
    const id = `monitor-${Date.now()}`;
    let p = createProgram();
    p = put(p, 'monitor', id, {
      id, subject: input.subject, policyRef: input.policyRef,
      interval: input.interval, status: 'Active', startedAt: new Date().toISOString(),
    });
    return complete(p, 'ok', { observer: id }) as StorageProgram<Result>;
  },

  observe(input: Record<string, unknown>) {
    const { observer } = input;
    let p = createProgram();
    p = get(p, 'monitor', observer as string, 'record');

    p = branch(p, 'record',
      (b) => complete(b, 'ok', { observer }),
      (b) => complete(b, 'not_found', { observer }),
    );

    return p as StorageProgram<Result>;
  },

  resolve(input: Record<string, unknown>) {
    const { observer, outcome } = input;
    let p = createProgram();
    p = get(p, 'monitor', observer as string, 'record');

    p = branch(p, 'record',
      (b) => {
        let b2 = put(b, 'monitor', observer as string, { lastOutcome: outcome, lastResolvedAt: new Date().toISOString() });
        return complete(b2, 'ok', { observer, outcome });
      },
      (b) => complete(b, 'not_found', { observer }),
    );

    return p as StorageProgram<Result>;
  },
};

export const monitorHandler = autoInterpret(_monitorHandler);
