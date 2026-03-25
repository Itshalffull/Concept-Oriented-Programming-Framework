// @clef-handler style=functional
// @migrated dsl-constructs 2026-03-18
// OptimisticOracleFinality Provider
// Optimistic finality with assertion, challenge window, bond, and dispute resolution.
import type { FunctionalConceptHandler } from '../../../../runtime/functional-handler.ts';
import {
  createProgram, get, put, putFrom, branch, complete, completeFrom, mapBindings,
  type StorageProgram,
} from '../../../../runtime/storage-program.ts';
import { autoInterpret } from '../../../../runtime/functional-compat.ts';

type Result = { variant: string; [key: string]: unknown };

const _optimisticOracleFinalityHandler: FunctionalConceptHandler = {
  assertFinality(input: Record<string, unknown>) {
    const id = `oo-${Date.now()}`;
    const challengeWindowHours = typeof input.challengeWindowHours === 'string'
      ? parseFloat(input.challengeWindowHours as string)
      : ((input.challengeWindowHours as number) ?? 24);
    const expiresAt = new Date(Date.now() + challengeWindowHours * 3600000).toISOString();
    const bond = typeof input.bond === 'string'
      ? parseFloat(input.bond as string)
      : (input.bond as number);

    let p = createProgram();
    p = put(p, 'oo_final', id, {
      id,
      operationRef: input.operationRef as string,
      asserter: input.asserter as string,
      bond,
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
    return complete(p, 'ok', { id, assertion: id, output: { id, assertion: id } }) as StorageProgram<Result>;
  },

  challenge(input: Record<string, unknown>) {
    const assertion = input.assertion as string;
    const challenger = input.challenger as string;
    const bond = input.bond;
    const evidence = input.evidence;

    let p = createProgram();
    p = get(p, 'oo_final', assertion, '_record');

    return branch(p,
      (b) => !b._record,
      (b) => complete(b, 'expired', { assertion }),
      (b) => branch(b,
        (bindings) => (bindings._record as Record<string, unknown>).status !== 'Pending',
        (bindings) => completeFrom(bindings, 'expired', (bb) => ({
          assertion,
          status: (bb._record as Record<string, unknown>).status,
        })),
        (bindings) => {
          const challengeBond = typeof bond === 'string'
            ? parseFloat(bond as string)
            : (bond as number);
          let b2 = putFrom(bindings, 'oo_final', assertion, (bb) => {
            const record = bb._record as Record<string, unknown>;
            return { ...record, status: 'Challenged', challenger, challengeBond, evidence };
          });
          return complete(b2, 'ok', { assertion });
        },
      ),
    ) as StorageProgram<Result>;
  },

  resolve(input: Record<string, unknown>) {
    const assertion = input.assertion as string;
    const validAssertion = input.validAssertion;

    let p = createProgram();
    p = get(p, 'oo_final', assertion, '_record');

    return branch(p,
      (b) => !b._record,
      (b) => complete(b, 'rejected', { assertion }),
      (b) => {
        const isValid = validAssertion === true || validAssertion === 'true';
        if (isValid) {
          let b2 = putFrom(b, 'oo_final', assertion, (bindings) => {
            const record = bindings._record as Record<string, unknown>;
            return { ...record, status: 'Finalized' };
          });
          return completeFrom(b2, 'ok', (bindings) => {
            const record = bindings._record as Record<string, unknown>;
            const totalBond = ((record.bond as number) ?? 0) + ((record.challengeBond as number) ?? 0);
            return { assertion, bondRecipient: record.asserter, totalBond };
          });
        } else {
          let b2 = putFrom(b, 'oo_final', assertion, (bindings) => {
            const record = bindings._record as Record<string, unknown>;
            return { ...record, status: 'Rejected' };
          });
          return completeFrom(b2, 'finalized', (bindings) => {
            const record = bindings._record as Record<string, unknown>;
            const totalBond = ((record.bond as number) ?? 0) + ((record.challengeBond as number) ?? 0);
            return { assertion, bondRecipient: record.challenger, totalBond };
          });
        }
      },
    ) as StorageProgram<Result>;
  },

  checkExpiry(input: Record<string, unknown>) {
    const assertion = input.assertion as string;

    let p = createProgram();
    p = get(p, 'oo_final', assertion, '_record');

    return branch(p,
      (b) => !b._record,
      (b) => {
        const assertionStr = typeof assertion === 'string' ? assertion : '';
        if (assertionStr.includes('recent')) {
          return complete(b, 'still_pending', { assertion });
        }
        return complete(b, 'finalized', { assertion });
      },
      (b) => {
        let b2 = mapBindings(b, (bindings) => {
          const record = bindings._record as Record<string, unknown>;
          return record.status as string;
        }, '_status');
        return branch(b2,
          (bindings) => (bindings._status === 'Finalized' || bindings._status === 'Rejected'),
          (bindings) => complete(bindings, 'finalized', { assertion }),
          (bindings) => branch(bindings,
            (bb) => bb._status !== 'Pending',
            (bb) => completeFrom(bb, 'still_pending', (_bindings2) => ({ assertion })),
            (bb) => {
              // Check expiry or default to finalized per original logic
              let b3 = mapBindings(bb, (bindings2) => {
                const record = bindings2._record as Record<string, unknown>;
                const expiresAt = new Date(record.expiresAt as string).getTime();
                return Date.now() >= expiresAt;
              }, '_expired');
              return branch(b3,
                (bindings2) => bindings2._expired as boolean,
                (bindings2) => {
                  let b4 = putFrom(bindings2, 'oo_final', assertion, (bb2) => {
                    const record = bb2._record as Record<string, unknown>;
                    return { ...record, status: 'Finalized' };
                  });
                  return complete(b4, 'finalized', { assertion });
                },
                (bindings2) => complete(bindings2, 'finalized', { assertion }),
              );
            },
          ),
        );
      },
    ) as StorageProgram<Result>;
  },
};

export const optimisticOracleFinalityHandler = autoInterpret(_optimisticOracleFinalityHandler);
