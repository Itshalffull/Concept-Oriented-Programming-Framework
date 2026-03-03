// BondingCurve Concept Handler
// Continuous token pricing with configurable curve types.
import type { ConceptHandler } from '@clef/runtime';

export const bondingCurveHandler: ConceptHandler = {
  async create(input, storage) {
    const id = `curve-${Date.now()}`;
    await storage.put('curve', id, {
      id, curveType: input.curveType, params: input.params,
      reserveToken: input.reserveToken, bondedToken: input.bondedToken,
      reserveBalance: 0, bondedSupply: 0,
    });
    return { variant: 'created', curve: id };
  },

  async buy(input, storage) {
    const { curve, buyer, reserveAmount } = input;
    const record = await storage.get('curve', curve as string);
    if (!record) return { variant: 'not_found', curve };
    // Stub: real impl computes tokens minted from curve formula
    const tokensOut = reserveAmount as number;
    await storage.put('curve', curve as string, {
      ...record,
      reserveBalance: (record.reserveBalance as number) + (reserveAmount as number),
      bondedSupply: (record.bondedSupply as number) + tokensOut,
    });
    return { variant: 'bought', tokensReceived: tokensOut, newPrice: 1.0 };
  },

  async sell(input, storage) {
    const { curve, seller, tokenAmount } = input;
    const record = await storage.get('curve', curve as string);
    if (!record) return { variant: 'not_found', curve };
    // Stub: real impl computes reserve returned from curve formula
    const reserveOut = tokenAmount as number;
    await storage.put('curve', curve as string, {
      ...record,
      reserveBalance: (record.reserveBalance as number) - reserveOut,
      bondedSupply: (record.bondedSupply as number) - (tokenAmount as number),
    });
    return { variant: 'sold', reserveReceived: reserveOut, newPrice: 1.0 };
  },

  async getPrice(input, storage) {
    const { curve, amount } = input;
    const record = await storage.get('curve', curve as string);
    if (!record) return { variant: 'not_found', curve };
    return { variant: 'price', spotPrice: 1.0, purchaseCost: amount };
  },
};
