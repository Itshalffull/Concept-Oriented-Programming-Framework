// @migrated dsl-constructs 2026-03-18
// OptimisticOracleFinality Provider
// Optimistic finality with assertion, challenge window, bond, and dispute resolution.
import type { FunctionalConceptHandler } from '../../../../runtime/functional-handler.ts';
import {
  createProgram, get, put, branch, complete, completeFrom,
  type StorageProgram,
} from '../../../../runtime/storage-program.ts';
import { autoInterpret } from '../../../../runtime/functional-compat.ts';

type Result = { variant: string; [key: string]: unknown };

const _optimisticOracleFinalityHandler: FunctionalConceptHandler = {
  assertFinality(input: Record<string, unknown>) {
    const id = `oo-${Date.now()}`;
    const challengeWindowHours = (input.challengeWindowHours as number) ?? 24;
    const expiresAt = new Date(Date.now() + challengeWindowHours * 3600000).toISOString();
    let p = createProgram();

    p = put(p, 'oo_final', id, {
      id,
      operationRef: input.operationRef,
      asserter: input.asserter,
      bond: input.bond as number,
      challengeWindowHours,
      expiresAt,
      status: 'Pending',
      challenger: null,
      challengeBond: null,
    });

    p = put(p, 'plugin-registry', `finality-provider:${id}`, {
      id: `finality-provider:${id}`,
      pluginKind: 'finality-provider',
      provider: 'OptimisticOracleFinality',
      instanceId: id,
    });

    return complete(p, 'asserted', { assertion: id }) as StorageProgram<Result>;
  },

  challenge(input: Record<string, unknown>) {
    const { assertion, challenger, bond } = input;
    let p = createProgram();
    p = get(p, 'oo_final', assertion as string, 'record');

    p = branch(p, 'record',
      (b) => {
        return completeFrom(b, 'challenged', (bindings) => {
          const record = bindings.record as Record<string, unknown>;
          if (record.status !== 'Pending') {
            return { variant: 'not_pending', assertion, status: record.status };
          }
          return { variant: 'challenged', assertion };
        });
      },
      (b) => complete(b, 'not_found', { assertion }),
    );

    return p as StorageProgram<Result>;
  },

  resolve(input: Record<string, unknown>) {
    const { assertion, validAssertion } = input;
    let p = createProgram();
    p = get(p, 'oo_final', assertion as string, 'record');

    p = branch(p, 'record',
      (b) => {
        return completeFrom(b, 'finalized', (bindings) => {
          const record = bindings.record as Record<string, unknown>;
          if (validAssertion) {
            return {
              variant: 'finalized', assertion,
              bondRecipient: record.asserter,
              totalBond: (record.bond as number) + ((record.challengeBond as number) ?? 0),
            };
          }
          return {
            variant: 'rejected', assertion,
            bondRecipient: record.challenger,
            totalBond: (record.bond as number) + ((record.challengeBond as number) ?? 0),
          };
        });
      },
      (b) => complete(b, 'not_found', { assertion }),
    );

    return p as StorageProgram<Result>;
  },

  checkExpiry(input: Record<string, unknown>) {
    const { assertion } = input;
    let p = createProgram();
    p = get(p, 'oo_final', assertion as string, 'record');

    p = branch(p, 'record',
      (b) => {
        return completeFrom(b, 'still_pending', (bindings) => {
          const record = bindings.record as Record<string, unknown>;
          if (record.status !== 'Pending') {
            return { variant: record.status as string, assertion };
          }
          const expiresAt = new Date(record.expiresAt as string).getTime();
          const now = Date.now();
          if (now >= expiresAt) {
            return { variant: 'finalized', assertion };
          }
          const remainingMs = expiresAt - now;
          const remainingHours = remainingMs / 3600000;
          return { variant: 'still_pending', assertion, remainingHours };
        });
      },
      (b) => complete(b, 'not_found', { assertion }),
    );

    return p as StorageProgram<Result>;
  },
};

export const optimisticOracleFinalityHandler = autoInterpret(_optimisticOracleFinalityHandler);
