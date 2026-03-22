// @clef-handler style=functional
// @migrated dsl-constructs 2026-03-18
// RageQuit Concept Handler
// Proportional exit for minority dissent (MolochDAO pattern).
import type { FunctionalConceptHandler } from '../../../../runtime/functional-handler.ts';
import {
  createProgram, get, put, branch, complete, completeFrom,
  type StorageProgram,
} from '../../../../runtime/storage-program.ts';
import { autoInterpret } from '../../../../runtime/functional-compat.ts';

type Result = { variant: string; [key: string]: unknown };

const _rageQuitHandler: FunctionalConceptHandler = {
  initiate(input: Record<string, unknown>) {
    const id = `rq-${Date.now()}`;
    let p = createProgram();
    p = put(p, 'ragequit', id, {
      id, member: input.member, shares: input.shares, loot: input.loot,
      status: 'Initiated', initiatedAt: new Date().toISOString(),
    });
    return complete(p, 'ok', { exit: id }) as StorageProgram<Result>;
  },

  calculateClaim(input: Record<string, unknown>) {
    const { exit } = input;
    let p = createProgram();
    p = get(p, 'ragequit', exit as string, 'record');

    p = branch(p, 'record',
      (b) => {
        const claims: Record<string, number> = {};
        let b2 = put(b, 'ragequit', exit as string, { claims, status: 'Calculated' });
        return complete(b2, 'ok', { exit, claims: JSON.stringify(claims) });
      },
      (b) => complete(b, 'not_found', { exit }),
    );

    return p as StorageProgram<Result>;
  },

  claim(input: Record<string, unknown>) {
    const { exit } = input;
    let p = createProgram();
    p = get(p, 'ragequit', exit as string, 'record');

    p = branch(p, 'record',
      (b) => {
        return completeFrom(b, 'claimed', (bindings) => {
          const record = bindings.record as Record<string, unknown>;
          if (record.status !== 'Calculated') return { variant: 'not_calculated', exit };
          return { variant: 'claimed', exit };
        });
      },
      (b) => complete(b, 'not_found', { exit }),
    );

    return p as StorageProgram<Result>;
  },
};

export const rageQuitHandler = autoInterpret(_rageQuitHandler);
