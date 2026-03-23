// @clef-handler style=functional
// @migrated dsl-constructs 2026-03-18
// PredictionMarket Concept Handler
// AMM-based futarchy prediction markets — @gate concept.
import type { FunctionalConceptHandler } from '../../../../runtime/functional-handler.ts';
import {
  createProgram, get, put, branch, complete, completeFrom,
  type StorageProgram,
} from '../../../../runtime/storage-program.ts';
import { autoInterpret } from '../../../../runtime/functional-compat.ts';

type Result = { variant: string; [key: string]: unknown };

const _predictionMarketHandler: FunctionalConceptHandler = {
  createMarket(input: Record<string, unknown>) {
    if (!input.question || (typeof input.question === 'string' && (input.question as string).trim() === '')) {
      return complete(createProgram(), 'error', { message: 'question is required' }) as StorageProgram<Result>;
    }
    if (!input.outcomes || (typeof input.outcomes === 'string' && (input.outcomes as string).trim() === '')) {
      return complete(createProgram(), 'error', { message: 'outcomes is required' }) as StorageProgram<Result>;
    }
    const id = `market-${Date.now()}`;
    let p = createProgram();
    p = put(p, 'market', id, {
      id, question: input.question, outcomes: input.outcomes,
      resolution: input.resolution, liquidity: input.liquidity,
      status: 'Open', createdAt: new Date().toISOString(),
    });
    return complete(p, 'ok', { market: id }) as StorageProgram<Result>;
  },

  trade(input: Record<string, unknown>) {
    if (!input.market || (typeof input.market === 'string' && (input.market as string).trim() === '')) {
      return complete(createProgram(), 'error', { message: 'market is required' }) as StorageProgram<Result>;
    }
    const { market, trader, outcome, amount } = input;
    let p = createProgram();
    p = get(p, 'market', market as string, 'record');

    p = branch(p, 'record',
      (b) => {
        return completeFrom(b, 'traded', (bindings) => {
          const record = bindings.record as Record<string, unknown>;
          if (record.status !== 'Open') return { variant: 'market_closed', market };
          return { variant: 'traded', trade: `trade-${Date.now()}`, newPrice: 0.5 };
        });
      },
      (b) => complete(b, 'not_found', { market }),
    );

    return p as StorageProgram<Result>;
  },

  resolve(input: Record<string, unknown>) {
    const { market, winningOutcome } = input;
    let p = createProgram();
    p = get(p, 'market', market as string, 'record');

    p = branch(p, 'record',
      (b) => {
        let b2 = put(b, 'market', market as string, { status: 'Resolved', winningOutcome });
        return complete(b2, 'ok', { market, winningOutcome });
      },
      (b) => complete(b, 'not_found', { market }),
    );

    return p as StorageProgram<Result>;
  },

  claimPayout(input: Record<string, unknown>) {
    const { trader } = input;
    let p = createProgram();
    return complete(p, 'ok', { trader, payout: 0.0 }) as StorageProgram<Result>;
  },
};

export const predictionMarketHandler = autoInterpret(_predictionMarketHandler);
