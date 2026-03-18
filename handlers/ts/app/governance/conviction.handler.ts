// @migrated dsl-constructs 2026-03-18
// Conviction Concept Handler
// Continuous staking with exponential charge.
import type { FunctionalConceptHandler } from '../../../../runtime/functional-handler.ts';
import {
  createProgram, get, put, putFrom, branch, complete, completeFrom,
  mapBindings, type StorageProgram,
} from '../../../../runtime/storage-program.ts';
import { autoInterpret } from '../../../../runtime/functional-compat.ts';

type Result = { variant: string; [key: string]: unknown };

const _convictionHandler: FunctionalConceptHandler = {
  registerProposal(input: Record<string, unknown>) {
    const id = `conviction-${Date.now()}`;
    let p = createProgram();
    p = put(p, 'conviction', id, {
      id, proposalRef: input.proposalRef, threshold: input.threshold,
      halfLifeDays: input.halfLifeDays, totalStaked: 0, stakes: [], status: 'Active',
    });
    return complete(p, 'registered', { proposal: id }) as StorageProgram<Result>;
  },

  stake(input: Record<string, unknown>) {
    const { proposal, staker, amount } = input;
    let p = createProgram();
    p = get(p, 'conviction', proposal as string, 'record');

    return branch(p, 'record',
      (thenP) => {
        thenP = putFrom(thenP, 'conviction', proposal as string, (bindings) => {
          const record = bindings.record as Record<string, unknown>;
          const stakes = record.stakes as Array<{ staker: unknown; amount: unknown; stakedAt: string }>;
          stakes.push({ staker, amount, stakedAt: new Date().toISOString() });
          const totalStaked = (record.totalStaked as number) + (amount as number);
          return { ...record, stakes, totalStaked };
        });
        return completeFrom(thenP, 'staked', (bindings) => {
          const record = bindings.record as Record<string, unknown>;
          const newTotal = (record.totalStaked as number) + (amount as number);
          return { variant: 'staked', proposal, newTotal };
        });
      },
      (elseP) => complete(elseP, 'not_found', { proposal }),
    ) as StorageProgram<Result>;
  },

  unstake(input: Record<string, unknown>) {
    const { proposal, staker, amount } = input;
    let p = createProgram();
    p = get(p, 'conviction', proposal as string, 'record');

    return branch(p, 'record',
      (thenP) => {
        thenP = putFrom(thenP, 'conviction', proposal as string, (bindings) => {
          const record = bindings.record as Record<string, unknown>;
          const totalStaked = Math.max(0, (record.totalStaked as number) - (amount as number));
          return { ...record, totalStaked };
        });
        return completeFrom(thenP, 'unstaked', (bindings) => {
          const record = bindings.record as Record<string, unknown>;
          const newTotal = Math.max(0, (record.totalStaked as number) - (amount as number));
          return { variant: 'unstaked', proposal, newTotal };
        });
      },
      (elseP) => complete(elseP, 'not_found', { proposal }),
    ) as StorageProgram<Result>;
  },

  updateConviction(input: Record<string, unknown>) {
    const { proposal } = input;
    let p = createProgram();
    p = get(p, 'conviction', proposal as string, 'record');

    return branch(p, 'record',
      (thenP) => {
        // Check if conviction meets threshold
        thenP = mapBindings(thenP, (bindings) => {
          const record = bindings.record as Record<string, unknown>;
          return (record.totalStaked as number) >= (record.threshold as number);
        }, 'triggered');

        // Write 'Triggered' status if threshold met
        thenP = putFrom(thenP, 'conviction', proposal as string, (bindings) => {
          const record = bindings.record as Record<string, unknown>;
          if (bindings.triggered) {
            return { ...record, status: 'Triggered' };
          }
          return record;
        });

        return completeFrom(thenP, 'conviction_update', (bindings) => {
          const record = bindings.record as Record<string, unknown>;
          const conviction = record.totalStaked as number;
          if (bindings.triggered) {
            return { variant: 'triggered', proposal, conviction };
          }
          return { variant: 'updated', proposal, conviction };
        });
      },
      (elseP) => complete(elseP, 'not_found', { proposal }),
    ) as StorageProgram<Result>;
  },
};

export const convictionHandler = autoInterpret(_convictionHandler);
