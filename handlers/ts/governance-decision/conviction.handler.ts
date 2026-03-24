// @clef-handler style=functional
// Conviction Concept Implementation
// Accumulates continuous support for proposals over time through token staking.
import type { FunctionalConceptHandler } from '../../../runtime/functional-handler.ts';
import {
  createProgram, get, put, putFrom, find, branch, complete, completeFrom, mapBindings,
  type StorageProgram,
} from '../../../runtime/storage-program.ts';
import { autoInterpret } from '../../../runtime/functional-compat.ts';

type Result = { variant: string; [key: string]: unknown };

let idCounter = 0;
function nextId(prefix: string): string {
  return `${prefix}-${++idCounter}`;
}

const DEFAULT_HALF_LIFE = 3 * 24 * 3600; // 3 days in seconds
const DEFAULT_MIN_STAKE = 1.0;

function calculateThreshold(requestedFunds: number, totalFunds: number): number {
  // Threshold is proportional to requested/total ratio, clamped 0.1..1.0
  const ratio = requestedFunds / totalFunds;
  return Math.min(1.0, Math.max(0.1, ratio * 10));
}

const _handler: FunctionalConceptHandler = {
  register() {
    return complete(createProgram(), 'ok', { name: 'Conviction' }) as StorageProgram<Result>;
  },

  registerProposal(input: Record<string, unknown>) {
    const proposalRef = input.proposalRef as string;
    const requestedFunds = input.requestedFunds as number;
    const totalFunds = input.totalFunds as number;

    if (!proposalRef || proposalRef.trim() === '') {
      return complete(createProgram(), 'error', { message: 'proposalRef is required' }) as StorageProgram<Result>;
    }

    const id = nextId('conviction');
    const threshold = calculateThreshold(requestedFunds, totalFunds);
    let p = createProgram();
    p = put(p, 'conviction_proposal', id, {
      id,
      proposalRef,
      conviction: 0.0,
      threshold,
      requestedFunds,
      status: 'Accumulating',
      halfLife: DEFAULT_HALF_LIFE,
      minStake: DEFAULT_MIN_STAKE,
    });
    return complete(p, 'ok', { proposal: id }) as StorageProgram<Result>;
  },

  stake(input: Record<string, unknown>) {
    const proposalId = input.proposal as string;
    const staker = input.staker as string;
    const amount = input.amount as number;

    if (!proposalId) {
      return complete(createProgram(), 'error', { message: 'proposal is required' }) as StorageProgram<Result>;
    }

    let p = createProgram();
    p = get(p, 'conviction_proposal', proposalId, 'proposalRecord');

    return branch(
      p,
      (b) => !b.proposalRecord,
      complete(createProgram(), 'error', { message: 'Conviction proposal not found' }),
      (() => {
        let b2 = createProgram();
        b2 = mapBindings(b2, (b) => {
          const rec = b.proposalRecord as Record<string, unknown>;
          return amount < (rec.minStake as number);
        }, '_belowMin');

        return branch(
          b2,
          (b) => !!b._belowMin,
          (() => {
            return complete(createProgram(), 'ok', { proposal: proposalId, amount }) as StorageProgram<Result>;
          })(),
          (() => {
            const stakeId = nextId('stake');
            let b3 = createProgram();
            b3 = put(b3, 'stake', stakeId, {
              id: stakeId,
              stakeProposal: proposalId,
              staker,
              amount,
              stakedAt: new Date().toISOString(),
            });
            return complete(b3, 'ok', { proposal: proposalId, staker, amount }) as StorageProgram<Result>;
          })(),
        ) as StorageProgram<Result>;
      })(),
    ) as StorageProgram<Result>;
  },

  unstake(input: Record<string, unknown>) {
    const proposalId = input.proposal as string;
    const staker = input.staker as string;

    if (!proposalId) {
      return complete(createProgram(), 'error', { message: 'proposal is required' }) as StorageProgram<Result>;
    }

    let p = createProgram();
    p = get(p, 'conviction_proposal', proposalId, 'proposalRecord');

    return branch(
      p,
      (b) => !b.proposalRecord,
      complete(createProgram(), 'error', { message: 'Conviction proposal not found' }),
      (() => {
        // Find and remove the stake
        const stakeKey = `${proposalId}::${staker}`;
        let b2 = createProgram();
        b2 = get(b2, 'stake', stakeKey, 'stakeRecord');
        return branch(
          b2,
          (b) => !b.stakeRecord,
          complete(createProgram(), 'error', { message: 'Stake not found for this staker' }),
          (() => {
            let b3 = createProgram();
            b3 = putFrom(b3, 'stake', stakeKey, (b) => {
              const rec = b.stakeRecord as Record<string, unknown>;
              return { ...rec, removed: true };
            });
            return completeFrom(b3, 'ok', (b) => {
              const rec = b.stakeRecord as Record<string, unknown>;
              return { proposal: proposalId, staker, amount: rec.amount };
            }) as StorageProgram<Result>;
          })(),
        ) as StorageProgram<Result>;
      })(),
    ) as StorageProgram<Result>;
  },

  updateConviction(input: Record<string, unknown>) {
    const proposalId = input.proposal as string;

    if (!proposalId) {
      return complete(createProgram(), 'error', { message: 'proposal is required' }) as StorageProgram<Result>;
    }

    let p = createProgram();
    p = get(p, 'conviction_proposal', proposalId, 'proposalRecord');

    return branch(
      p,
      (b) => !b.proposalRecord,
      complete(createProgram(), 'error', { message: 'Conviction proposal not found' }),
      (() => {
        let b2 = createProgram();
        b2 = mapBindings(b2, (b) => {
          const rec = b.proposalRecord as Record<string, unknown>;
          const prevConviction = rec.conviction as number;
          const halfLife = rec.halfLife as number;
          // Simplified exponential charge: each update adds time-decayed conviction
          const decayFactor = Math.pow(0.5, 1 / halfLife);
          return prevConviction * decayFactor + 1.0; // +1.0 for time unit
        }, '_newConviction');

        return branch(
          b2,
          (b) => {
            const rec = (b as Record<string, unknown>).proposalRecord as Record<string, unknown>;
            return (b._newConviction as number) >= (rec.threshold as number);
          },
          (() => {
            let b3 = createProgram();
            b3 = putFrom(b3, 'conviction_proposal', proposalId, (b) => {
              const rec = b.proposalRecord as Record<string, unknown>;
              return { ...rec, conviction: b._newConviction, status: 'Triggered' };
            });
            return completeFrom(b3, 'ok', (b) => ({
              proposal: proposalId,
              conviction: b._newConviction,
            })) as StorageProgram<Result>;
          })(),
          (() => {
            let b3 = createProgram();
            b3 = putFrom(b3, 'conviction_proposal', proposalId, (b) => {
              const rec = b.proposalRecord as Record<string, unknown>;
              return { ...rec, conviction: b._newConviction };
            });
            return completeFrom(b3, 'ok', (b) => {
              const rec = (b as Record<string, unknown>).proposalRecord as Record<string, unknown>;
              return {
                proposal: proposalId,
                currentConviction: b._newConviction,
                threshold: rec.threshold,
              };
            }) as StorageProgram<Result>;
          })(),
        ) as StorageProgram<Result>;
      })(),
    ) as StorageProgram<Result>;
  },
};

export const convictionHandler = autoInterpret(_handler);
