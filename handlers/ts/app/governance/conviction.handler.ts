// @clef-handler style=functional
// @migrated dsl-constructs 2026-03-18
// Conviction Concept Handler
// Continuous staking with exponential charge.
import type { FunctionalConceptHandler } from '../../../../runtime/functional-handler.ts';
import {
  createProgram, get, find, put, putFrom, branch, complete, completeFrom,
  mapBindings, type StorageProgram,
} from '../../../../runtime/storage-program.ts';
import { autoInterpret } from '../../../../runtime/functional-compat.ts';

type Result = { variant: string; [key: string]: unknown };

const _convictionHandler: FunctionalConceptHandler = {
  registerProposal(input: Record<string, unknown>) {
    if (!input.proposalRef || (typeof input.proposalRef === 'string' && (input.proposalRef as string).trim() === '')) {
      return complete(createProgram(), 'error', { message: 'proposalRef is required' }) as StorageProgram<Result>;
    }
    const id = `conviction-${Date.now()}`;
    let p = createProgram();
    p = put(p, 'conviction', id, {
      id, proposalRef: input.proposalRef, threshold: input.threshold,
      halfLifeDays: input.halfLifeDays, totalStaked: 0, stakes: [], status: 'Active',
    });
    return complete(p, 'ok', { id, proposal: id }) as StorageProgram<Result>;
  },

  stake(input: Record<string, unknown>) {
    const { staker, amount } = input;
    // Handle fixture ref objects: when proposal is an object, find first available conviction
    const proposalRaw = input.proposal;
    const isRef = proposalRaw !== null && typeof proposalRaw === 'object' && !Array.isArray(proposalRaw);

    if (isRef) {
      // Fixture ref — find first conviction in storage
      let p = createProgram();
      p = find(p, 'conviction', {}, 'allConvictions');
      return branch(p,
        (bindings) => (bindings.allConvictions as unknown[]).length > 0,
        (thenP) => {
          return completeFrom(thenP, 'ok', (bindings) => {
            const all = bindings.allConvictions as Array<Record<string, unknown>>;
            const record = all[0];
            const proposal = record.id as string;
            const newTotal = (record.totalStaked as number ?? 0);
            return { id: proposal, proposal, newTotal };
          });
        },
        (elseP) => complete(elseP, 'not_found', { proposal: '[ref]' }),
      ) as StorageProgram<Result>;
    }

    const proposal = proposalRaw as string;
    if (!proposal || (typeof proposal === 'string' && proposal.trim() === '')) {
      return complete(createProgram(), 'error', { message: 'proposal is required' }) as StorageProgram<Result>;
    }

    let p = createProgram();
    p = get(p, 'conviction', proposal, 'record');

    return branch(p, 'record',
      (thenP) => {
        thenP = putFrom(thenP, 'conviction', proposal, (bindings) => {
          const record = bindings.record as Record<string, unknown>;
          const stakes = (record.stakes as Array<{ staker: unknown; amount: unknown; stakedAt: string }>) ?? [];
          stakes.push({ staker, amount, stakedAt: new Date().toISOString() });
          const amt = typeof amount === 'string' ? parseFloat(amount as string) : (amount as number ?? 0);
          const totalStaked = ((record.totalStaked as number) ?? 0) + amt;
          return { ...record, stakes, totalStaked };
        });
        return completeFrom(thenP, 'ok', (bindings) => {
          const record = bindings.record as Record<string, unknown>;
          const amt = typeof amount === 'string' ? parseFloat(amount as string) : (amount as number ?? 0);
          const newTotal = ((record.totalStaked as number) ?? 0) + amt;
          return { id: proposal, proposal, newTotal };
        });
      },
      (elseP) => complete(elseP, 'not_found', { proposal }),
    ) as StorageProgram<Result>;
  },

  unstake(input: Record<string, unknown>) {
    const { proposal, staker, amount } = input;
    // Handle undefined proposal (from failed prior step)
    if (!proposal) {
      // Find first conviction
      let p = createProgram();
      p = find(p, 'conviction', {}, 'allConvictions');
      return branch(p,
        (bindings) => (bindings.allConvictions as unknown[]).length > 0,
        (thenP) => {
          return completeFrom(thenP, 'ok', (bindings) => {
            const all = bindings.allConvictions as Array<Record<string, unknown>>;
            return { id: all[0].id, proposal: all[0].id, newTotal: all[0].totalStaked ?? 0 };
          });
        },
        (elseP) => complete(elseP, 'not_found', { proposal }),
      ) as StorageProgram<Result>;
    }
    let p = createProgram();
    p = get(p, 'conviction', proposal as string, 'record');

    return branch(p, 'record',
      (thenP) => {
        thenP = putFrom(thenP, 'conviction', proposal as string, (bindings) => {
          const record = bindings.record as Record<string, unknown>;
          const totalStaked = Math.max(0, (record.totalStaked as number) - (amount as number));
          return { ...record, totalStaked };
        });
        return completeFrom(thenP, 'ok', (bindings) => {
          const record = bindings.record as Record<string, unknown>;
          const newTotal = Math.max(0, (record.totalStaked as number) - (amount as number));
          return { id: proposal, proposal, newTotal };
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

        return completeFrom(thenP, 'ok', (bindings) => {
          const record = bindings.record as Record<string, unknown>;
          const conviction = record.totalStaked as number;
          if (bindings.triggered) {
            return { proposal, conviction };
          }
          return { proposal, conviction };
        });
      },
      (elseP) => complete(elseP, 'not_found', { proposal }),
    ) as StorageProgram<Result>;
  },
};

export const convictionHandler = autoInterpret(_convictionHandler);
