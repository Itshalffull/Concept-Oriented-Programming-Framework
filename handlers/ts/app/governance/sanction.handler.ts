// @clef-handler style=functional
// @migrated dsl-constructs 2026-03-18
// Sanction Concept Handler
// Graduated consequences and rewards (Ostrom DP5).
import type { FunctionalConceptHandler } from '../../../../runtime/functional-handler.ts';
import {
  createProgram, get, put, branch, complete, completeFrom, mapBindings,
  type StorageProgram,
} from '../../../../runtime/storage-program.ts';
import { autoInterpret } from '../../../../runtime/functional-compat.ts';

type Result = { variant: string; [key: string]: unknown };

const _sanctionHandler: FunctionalConceptHandler = {
  impose(input: Record<string, unknown>) {
    if (!input.subject || (typeof input.subject === 'string' && (input.subject as string).trim() === '')) {
      return complete(createProgram(), 'error', { message: 'subject is required' }) as StorageProgram<Result>;
    }
    const id = `sanction-${Date.now()}`;
    let p = createProgram();
    p = put(p, 'sanction', id, {
      id, subject: input.subject, severity: input.severity,
      consequence: input.consequence, reason: input.reason,
      status: 'Active', imposedAt: new Date().toISOString(),
    });
    return complete(p, 'ok', { sanction: id }) as StorageProgram<Result>;
  },

  escalate(input: Record<string, unknown>) {
    const { sanction } = input;
    let p = createProgram();
    p = get(p, 'sanction', sanction as string, 'record');

    p = branch(p, 'record',
      (b) => {
        b = mapBindings(b, (bindings) => {
          const record = bindings.record as Record<string, unknown>;
          const levels = ['Warning', 'Minor', 'Major', 'Critical', 'Expulsion'];
          const idx = levels.indexOf(record.severity as string);
          return levels[Math.min(idx + 1, levels.length - 1)];
        }, 'newSeverity');

        let b2 = put(b, 'sanction', sanction as string, { severity: '' });
        return completeFrom(b2, 'escalated', (bindings) => {
          return { sanction, newSeverity: bindings.newSeverity };
        });
      },
      (b) => complete(b, 'not_found', { sanction }),
    );

    return p as StorageProgram<Result>;
  },

  appeal(input: Record<string, unknown>) {
    const { sanction, appellant, grounds } = input;
    let p = createProgram();
    p = put(p, 'appeal', `appeal-${sanction}`, { sanction, appellant, grounds, status: 'Pending', appealedAt: new Date().toISOString() });
    return complete(p, 'ok', { sanction }) as StorageProgram<Result>;
  },

  pardon(input: Record<string, unknown>) {
    const { sanction, reason } = input;
    let p = createProgram();
    p = get(p, 'sanction', sanction as string, 'record');

    p = branch(p, 'record',
      (b) => {
        let b2 = put(b, 'sanction', sanction as string, { status: 'Pardoned', pardonReason: reason });
        return complete(b2, 'ok', { sanction });
      },
      (b) => complete(b, 'not_found', { sanction }),
    );

    return p as StorageProgram<Result>;
  },

  reward(input: Record<string, unknown>) {
    if (!input.subject || (typeof input.subject === 'string' && (input.subject as string).trim() === '')) {
      return complete(createProgram(), 'error', { message: 'subject is required' }) as StorageProgram<Result>;
    }
    const id = `reward-${Date.now()}`;
    let p = createProgram();
    p = put(p, 'sanction', id, {
      id, subject: input.subject, type: input.type,
      amount: input.amount, reason: input.reason,
      status: 'Active', isReward: true, awardedAt: new Date().toISOString(),
    });
    return complete(p, 'ok', { sanction: id }) as StorageProgram<Result>;
  },
};

export const sanctionHandler = autoInterpret(_sanctionHandler);
