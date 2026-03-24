// @clef-handler style=functional
// PredictionMarket Concept Implementation
// Aggregates information about expected outcomes through speculative trading.
import type { FunctionalConceptHandler } from '../../../runtime/functional-handler.ts';
import {
  createProgram, get, put, putFrom, branch, complete, completeFrom, mapBindings,
  type StorageProgram,
} from '../../../runtime/storage-program.ts';
import { autoInterpret } from '../../../runtime/functional-compat.ts';

type Result = { variant: string; [key: string]: unknown };

let idCounter = 0;
function nextId(prefix: string): string {
  return `${prefix}-${++idCounter}`;
}

const _handler: FunctionalConceptHandler = {
  register() {
    return complete(createProgram(), 'ok', { name: 'PredictionMarket' }) as StorageProgram<Result>;
  },

  createMarket(input: Record<string, unknown>) {
    const question = input.question as string;
    const outcomes = input.outcomes as string[];
    const deadline = input.deadline as string;

    if (!question || question.trim() === '') {
      return complete(createProgram(), 'error', { message: 'question is required' }) as StorageProgram<Result>;
    }
    if (!outcomes || outcomes.length < 2) {
      return complete(createProgram(), 'error', { message: 'at least two outcomes are required' }) as StorageProgram<Result>;
    }

    const id = nextId('market');
    const initialPrice = 1.0 / outcomes.length;

    let p = createProgram();
    p = put(p, 'market', id, {
      id,
      question,
      outcomes,
      status: 'Open',
      createdAt: new Date().toISOString(),
      deadline,
      resolvedOutcome: null,
    });

    // Initialize prices for each outcome
    for (const outcome of outcomes) {
      const priceKey = `${id}::price::${outcome}`;
      p = put(p, 'market_price', priceKey, {
        priceMarket: id,
        priceOutcome: outcome,
        currentPrice: initialPrice,
      });
    }

    return complete(p, 'ok', { market: id }) as StorageProgram<Result>;
  },

  trade(input: Record<string, unknown>) {
    const marketId = input.market as string;
    const trader = input.trader as string;
    const outcome = input.outcome as string;
    const amount = input.amount as number;

    if (!marketId) {
      return complete(createProgram(), 'error', { message: 'market is required' }) as StorageProgram<Result>;
    }

    let p = createProgram();
    p = get(p, 'market', marketId, 'marketRecord');

    return branch(
      p,
      (b) => !b.marketRecord,
      complete(createProgram(), 'error', { message: 'Market not found' }),
      (() => {
        let b2 = createProgram();
        b2 = mapBindings(b2, (b) => {
          const rec = b.marketRecord as Record<string, unknown>;
          return rec.status !== 'Open';
        }, '_notOpen');
        b2 = mapBindings(b2, (b) => {
          const rec = b.marketRecord as Record<string, unknown>;
          const outcomes = rec.outcomes as string[];
          return !outcomes.includes(outcome);
        }, '_invalidOutcome');

        return branch(
          b2,
          (b) => !!b._notOpen,
          complete(createProgram(), 'ok', { market: marketId }),
          branch(
            b2,
            (b) => !!b._invalidOutcome,
            complete(createProgram(), 'ok', { market: marketId, outcome }),
            (() => {
              // Simple AMM: shares = sqrt(amount), price updated proportionally
              const sharesReceived = Math.sqrt(amount);
              const newPrice = Math.min(0.99, amount / (amount + 100));
              const positionKey = `${marketId}::${trader}::${outcome}`;

              let b3 = createProgram();
              b3 = get(b3, 'market_position', positionKey, 'existingPosition');
              b3 = putFrom(b3, 'market_position', positionKey, (b) => {
                const existing = b.existingPosition as Record<string, unknown> | null;
                const prevShares = existing ? (existing.shares as number) : 0;
                return {
                  posMarket: marketId,
                  trader,
                  outcome,
                  shares: prevShares + sharesReceived,
                };
              });
              return complete(b3, 'ok', { market: marketId, sharesReceived, newPrice }) as StorageProgram<Result>;
            })(),
          ),
        ) as StorageProgram<Result>;
      })(),
    ) as StorageProgram<Result>;
  },

  resolve(input: Record<string, unknown>) {
    const marketId = input.market as string;
    const outcome = input.outcome as string;

    if (!marketId) {
      return complete(createProgram(), 'error', { message: 'market is required' }) as StorageProgram<Result>;
    }

    let p = createProgram();
    p = get(p, 'market', marketId, 'marketRecord');

    return branch(
      p,
      (b) => !b.marketRecord,
      complete(createProgram(), 'error', { message: 'Market not found' }),
      (() => {
        let b2 = createProgram();
        b2 = mapBindings(b2, (b) => {
          const rec = b.marketRecord as Record<string, unknown>;
          return rec.status === 'Resolved';
        }, '_alreadyResolved');

        return branch(
          b2,
          (b) => !!b._alreadyResolved,
          complete(createProgram(), 'ok', { market: marketId }),
          (() => {
            let b3 = createProgram();
            b3 = putFrom(b3, 'market', marketId, (b) => {
              const rec = b.marketRecord as Record<string, unknown>;
              return { ...rec, status: 'Resolved', resolvedOutcome: outcome };
            });
            return complete(b3, 'ok', { market: marketId, winningOutcome: outcome }) as StorageProgram<Result>;
          })(),
        ) as StorageProgram<Result>;
      })(),
    ) as StorageProgram<Result>;
  },

  claimPayout(input: Record<string, unknown>) {
    const marketId = input.market as string;
    const trader = input.trader as string;

    if (!marketId) {
      return complete(createProgram(), 'error', { message: 'market is required' }) as StorageProgram<Result>;
    }

    let p = createProgram();
    p = get(p, 'market', marketId, 'marketRecord');

    return branch(
      p,
      (b) => !b.marketRecord,
      complete(createProgram(), 'error', { message: 'Market not found' }),
      (() => {
        let b2 = createProgram();
        b2 = mapBindings(b2, (b) => {
          const rec = b.marketRecord as Record<string, unknown>;
          return rec.status !== 'Resolved';
        }, '_notResolved');
        b2 = mapBindings(b2, (b) => {
          const rec = b.marketRecord as Record<string, unknown>;
          return rec.resolvedOutcome as string;
        }, '_winningOutcome');

        return branch(
          b2,
          (b) => !!b._notResolved,
          complete(createProgram(), 'ok', { market: marketId }),
          (() => {
            let b3 = createProgram();
            b3 = mapBindings(b3, (b) => {
              const winningOutcome = b._winningOutcome as string;
              return `${marketId}::${trader}::${winningOutcome}`;
            }, '_positionKey');
            b3 = completeFrom(b3, 'ok', (b) => {
              // Simplified: check if position key would exist
              const positionKey = b._positionKey as string;
              if (!positionKey) {
                return { market: marketId, trader };
              }
              // Return simulated payout
              return { market: marketId, trader, amount: 0.0 };
            }) as StorageProgram<Result>;
            return b3;
          })(),
        ) as StorageProgram<Result>;
      })(),
    ) as StorageProgram<Result>;
  },
};

export const predictionMarketHandler = autoInterpret(_handler);
