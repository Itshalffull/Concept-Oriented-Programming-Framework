// @clef-handler style=functional
// OptimisticApproval Concept Implementation
// Assumes decisions are approved unless challenged within a dispute window.
import type { FunctionalConceptHandler } from '../../../runtime/functional-handler.ts';
import {
  createProgram, get, put, putFrom, branch, complete, completeFrom, mapBindings,
  type StorageProgram,
} from '../../../runtime/storage-program.ts';
import { autoInterpret } from '../../../runtime/functional-compat.ts';

type Result = { variant: string; [key: string]: unknown };

let idCounter = 0;
function nextId(): string {
  return `assertion-${++idCounter}`;
}

const _handler: FunctionalConceptHandler = {
  register() {
    return complete(createProgram(), 'ok', { name: 'OptimisticApproval' }) as StorageProgram<Result>;
  },

  assert(input: Record<string, unknown>) {
    const asserter = input.asserter as string;
    const payload = input.payload as string;
    const bond = input.bond as number;
    const challengePeriodHours = input.challengePeriodHours as number;

    if (!asserter || asserter.trim() === '') {
      return complete(createProgram(), 'error', { message: 'asserter is required' }) as StorageProgram<Result>;
    }
    if (!bond || bond <= 0) {
      return complete(createProgram(), 'error', { message: 'bond must be greater than zero' }) as StorageProgram<Result>;
    }

    const id = nextId();
    const now = new Date();
    const expiresAt = new Date(now.getTime() + challengePeriodHours * 3600 * 1000).toISOString();

    let p = createProgram();
    p = put(p, 'assertion', id, {
      id,
      asserter,
      payload,
      bond,
      challengePeriod: challengePeriodHours,
      createdAt: now.toISOString(),
      expiresAt,
      status: 'Pending',
      challenger: null,
      challengerBond: null,
    });
    return complete(p, 'ok', { assertion: id }) as StorageProgram<Result>;
  },

  challenge(input: Record<string, unknown>) {
    const assertionId = input.assertion as string;
    const challenger = input.challenger as string;
    const bond = input.bond as number;
    const evidence = input.evidence as string;

    if (!assertionId) {
      return complete(createProgram(), 'error', { message: 'assertion is required' }) as StorageProgram<Result>;
    }

    let p = createProgram();
    p = get(p, 'assertion', assertionId, 'assertionRecord');

    return branch(
      p,
      (b) => !b.assertionRecord,
      complete(createProgram(), 'error', { message: 'Assertion not found' }),
      (() => {
        let b2 = createProgram();
        b2 = mapBindings(b2, (b) => {
          const rec = b.assertionRecord as Record<string, unknown>;
          return new Date() > new Date(rec.expiresAt as string);
        }, '_expired');

        return branch(
          b2,
          (b) => !!b._expired,
          complete(createProgram(), 'ok', { assertion: assertionId }),
          (() => {
            let b3 = createProgram();
            b3 = putFrom(b3, 'assertion', assertionId, (b) => {
              const rec = b.assertionRecord as Record<string, unknown>;
              return { ...rec, status: 'Challenged', challenger, challengerBond: bond, evidence };
            });
            return complete(b3, 'ok', { assertion: assertionId }) as StorageProgram<Result>;
          })(),
        ) as StorageProgram<Result>;
      })(),
    ) as StorageProgram<Result>;
  },

  finalize(input: Record<string, unknown>) {
    const assertionId = input.assertion as string;

    if (!assertionId) {
      return complete(createProgram(), 'error', { message: 'assertion is required' }) as StorageProgram<Result>;
    }

    let p = createProgram();
    p = get(p, 'assertion', assertionId, 'assertionRecord');

    return branch(
      p,
      (b) => !b.assertionRecord,
      complete(createProgram(), 'error', { message: 'Assertion not found' }),
      (() => {
        let b2 = createProgram();
        b2 = mapBindings(b2, (b) => {
          const rec = b.assertionRecord as Record<string, unknown>;
          return new Date() > new Date(rec.expiresAt as string);
        }, '_expired');
        b2 = mapBindings(b2, (b) => {
          const rec = b.assertionRecord as Record<string, unknown>;
          return rec.status === 'Challenged';
        }, '_challenged');

        return branch(
          b2,
          (b) => !!b._challenged,
          complete(createProgram(), 'ok', { assertion: assertionId }),
          (() => {
            return branch(
              createProgram(),
              (b) => !!(b2 as unknown as Record<string, unknown>)._expired,
              (() => {
                let b3 = createProgram();
                b3 = putFrom(b3, 'assertion', assertionId, (b) => {
                  const rec = b.assertionRecord as Record<string, unknown>;
                  return { ...rec, status: 'Approved' };
                });
                return complete(b3, 'ok', { assertion: assertionId }) as StorageProgram<Result>;
              })(),
              complete(createProgram(), 'ok', { assertion: assertionId }),
            ) as StorageProgram<Result>;
          })(),
        ) as StorageProgram<Result>;
      })(),
    ) as StorageProgram<Result>;
  },

  resolve(input: Record<string, unknown>) {
    const assertionId = input.assertion as string;
    const outcome = input.outcome as string;

    if (!assertionId) {
      return complete(createProgram(), 'error', { message: 'assertion is required' }) as StorageProgram<Result>;
    }

    let p = createProgram();
    p = get(p, 'assertion', assertionId, 'assertionRecord');

    return branch(
      p,
      (b) => !b.assertionRecord,
      complete(createProgram(), 'error', { message: 'Assertion not found' }),
      (() => {
        const approved = outcome === 'approved';
        let b2 = createProgram();
        b2 = putFrom(b2, 'assertion', assertionId, (b) => {
          const rec = b.assertionRecord as Record<string, unknown>;
          return { ...rec, status: approved ? 'Approved' : 'Rejected' };
        });
        if (approved) {
          return complete(b2, 'ok', { assertion: assertionId }) as StorageProgram<Result>;
        }
        return complete(b2, 'rejected', { assertion: assertionId }) as StorageProgram<Result>;
      })(),
    ) as StorageProgram<Result>;
  },
};

export const optimisticApprovalHandler = autoInterpret(_handler);
