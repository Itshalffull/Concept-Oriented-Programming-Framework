// @clef-handler style=functional
// @migrated dsl-constructs 2026-03-18
// Treasury Concept Handler
// Collective asset management with authorization gates.
import type { FunctionalConceptHandler } from '../../../../runtime/functional-handler.ts';
import {
  createProgram, get, put, putFrom, branch, complete, completeFrom, mapBindings,
  type StorageProgram,
} from '../../../../runtime/storage-program.ts';
import { autoInterpret } from '../../../../runtime/functional-compat.ts';

type Result = { variant: string; [key: string]: unknown };

const _treasuryHandler: FunctionalConceptHandler = {
  deposit(input: Record<string, unknown>) {
    const { vault, token, amount } = input;
    const key = `${vault}:${token}`;
    let p = createProgram();
    p = get(p, 'vault', key, 'record');

    p = mapBindings(p, (bindings) => {
      const record = (bindings.record as Record<string, unknown>) ?? { balance: 0 };
      return (record.balance as number) + (amount as number);
    }, 'newBalance');

    p = putFrom(p, 'vault', key, (bindings) => ({
      vault, token, balance: bindings.newBalance as number, updatedAt: new Date().toISOString(),
    }));

    return completeFrom(p, 'deposited', (bindings) => {
      return { vault, newBalance: bindings.newBalance };
    }) as StorageProgram<Result>;
  },

  withdraw(input: Record<string, unknown>) {
    const { vault, token, amount } = input;
    const key = `${vault}:${token}`;
    let p = createProgram();
    p = get(p, 'vault', key, 'record');

    p = mapBindings(p, (bindings) => {
      const record = (bindings.record as Record<string, unknown>) ?? { balance: 0 };
      return record.balance as number;
    }, 'balance');

    p = branch(p,
      (bindings) => (bindings.balance as number) < (amount as number),
      (b) => completeFrom(b, 'insufficient', (bindings) => {
        return { vault, available: bindings.balance, requested: amount };
      }),
      (b) => {
        b = mapBindings(b, (bindings) => {
          return (bindings.balance as number) - (amount as number);
        }, 'newBalance');

        let b2 = putFrom(b, 'vault', key, (bindings) => ({
          vault, token, balance: bindings.newBalance as number, updatedAt: new Date().toISOString(),
        }));
        return completeFrom(b2, 'withdrawn', (bindings) => {
          return { vault, newBalance: bindings.newBalance };
        });
      },
    );

    return p as StorageProgram<Result>;
  },

  allocate(input: Record<string, unknown>) {
    const id = `alloc-${Date.now()}`;
    let p = createProgram();
    p = put(p, 'allocation', id, {
      id, vault: input.vault, token: input.token, amount: input.amount,
      purpose: input.purpose, expiresAt: input.expiresAt ?? null, status: 'Active',
    });
    return complete(p, 'allocated', { allocation: id }) as StorageProgram<Result>;
  },

  releaseAllocation(input: Record<string, unknown>) {
    const { allocation } = input;
    let p = createProgram();
    p = get(p, 'allocation', allocation as string, 'record');

    p = branch(p, 'record',
      (b) => {
        let b2 = put(b, 'allocation', allocation as string, { status: 'Released', releasedAt: new Date().toISOString() });
        return complete(b2, 'released', { allocation });
      },
      (b) => complete(b, 'not_found', { allocation }),
    );

    return p as StorageProgram<Result>;
  },
};

export const treasuryHandler = autoInterpret(_treasuryHandler);
