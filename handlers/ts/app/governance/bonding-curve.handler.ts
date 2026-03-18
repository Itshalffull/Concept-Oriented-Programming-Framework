// @migrated dsl-constructs 2026-03-18
// BondingCurve Concept Handler
// Continuous token pricing with configurable curve types.
import type { FunctionalConceptHandler } from '../../../../runtime/functional-handler.ts';
import {
  createProgram, get, put, putFrom, branch, complete, completeFrom,
  mapBindings, type StorageProgram,
} from '../../../../runtime/storage-program.ts';
import { autoInterpret } from '../../../../runtime/functional-compat.ts';

type Result = { variant: string; [key: string]: unknown };

const _bondingCurveHandler: FunctionalConceptHandler = {
  create(input: Record<string, unknown>) {
    const id = `curve-${Date.now()}`;
    let p = createProgram();
    p = put(p, 'curve', id, {
      id, curveType: input.curveType, params: input.params,
      reserveToken: input.reserveToken, bondedToken: input.bondedToken,
      reserveBalance: 0, bondedSupply: 0,
    });
    return complete(p, 'created', { curve: id }) as StorageProgram<Result>;
  },

  buy(input: Record<string, unknown>) {
    const { curve, buyer, reserveAmount } = input;
    let p = createProgram();
    p = get(p, 'curve', curve as string, 'record');

    return branch(p, 'record',
      (thenP) => {
        // Stub: real impl computes tokens minted from curve formula
        const tokensOut = reserveAmount as number;
        thenP = putFrom(thenP, 'curve', curve as string, (bindings) => {
          const record = bindings.record as Record<string, unknown>;
          return {
            ...record,
            reserveBalance: (record.reserveBalance as number) + (reserveAmount as number),
            bondedSupply: (record.bondedSupply as number) + tokensOut,
          };
        });
        return complete(thenP, 'bought', { tokensReceived: tokensOut, newPrice: 1.0 });
      },
      (elseP) => complete(elseP, 'not_found', { curve }),
    ) as StorageProgram<Result>;
  },

  sell(input: Record<string, unknown>) {
    const { curve, seller, tokenAmount } = input;
    let p = createProgram();
    p = get(p, 'curve', curve as string, 'record');

    return branch(p, 'record',
      (thenP) => {
        // Stub: real impl computes reserve returned from curve formula
        const reserveOut = tokenAmount as number;
        thenP = putFrom(thenP, 'curve', curve as string, (bindings) => {
          const record = bindings.record as Record<string, unknown>;
          return {
            ...record,
            reserveBalance: (record.reserveBalance as number) - reserveOut,
            bondedSupply: (record.bondedSupply as number) - (tokenAmount as number),
          };
        });
        return complete(thenP, 'sold', { reserveReceived: reserveOut, newPrice: 1.0 });
      },
      (elseP) => complete(elseP, 'not_found', { curve }),
    ) as StorageProgram<Result>;
  },

  getPrice(input: Record<string, unknown>) {
    const { curve, amount } = input;
    let p = createProgram();
    p = get(p, 'curve', curve as string, 'record');

    return branch(p, 'record',
      (thenP) => complete(thenP, 'price', { spotPrice: 1.0, purchaseCost: amount }),
      (elseP) => complete(elseP, 'not_found', { curve }),
    ) as StorageProgram<Result>;
  },
};

export const bondingCurveHandler = autoInterpret(_bondingCurveHandler);
