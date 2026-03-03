// ============================================================
// Bonding Curve Concept Conformance Tests
//
// Tests for bonding curve lifecycle: creation, buy/sell
// operations, and price queries.
// ============================================================

import { describe, it, expect, beforeEach } from 'vitest';
import { createInMemoryStorage } from '../../runtime/adapters/storage.js';
import { bondingCurveHandler } from '../../handlers/ts/app/governance/bonding-curve.handler.js';

describe('Bonding Curve Handler', () => {
  let storage: ReturnType<typeof createInMemoryStorage>;

  beforeEach(() => {
    storage = createInMemoryStorage();
  });

  describe('create', () => {
    it('creates a bonding curve', async () => {
      const result = await bondingCurveHandler.create({
        curveType: 'linear', params: { slope: 0.01, intercept: 1 },
        reserveToken: 'ETH', bondedToken: 'GOV',
      }, storage);
      expect(result.variant).toBe('created');
      expect(result.curve).toBeDefined();
    });
  });

  describe('buy', () => {
    it('buys tokens along the curve', async () => {
      const c = await bondingCurveHandler.create({
        curveType: 'linear', params: { slope: 0.01, intercept: 1 },
        reserveToken: 'ETH', bondedToken: 'GOV',
      }, storage);
      const result = await bondingCurveHandler.buy({
        curve: c.curve, buyer: 'alice', reserveAmount: 100,
      }, storage);
      expect(result.variant).toBe('bought');
      expect(result.tokensReceived).toBeGreaterThan(0);
    });
  });

  describe('sell', () => {
    it('sells tokens along the curve', async () => {
      const c = await bondingCurveHandler.create({
        curveType: 'linear', params: { slope: 0.01, intercept: 1 },
        reserveToken: 'ETH', bondedToken: 'GOV',
      }, storage);
      await bondingCurveHandler.buy({ curve: c.curve, buyer: 'alice', reserveAmount: 100 }, storage);
      const result = await bondingCurveHandler.sell({
        curve: c.curve, seller: 'alice', tokenAmount: 10,
      }, storage);
      expect(result.variant).toBe('sold');
      expect(result.reserveReceived).toBeGreaterThan(0);
    });
  });

  describe('getPrice', () => {
    it('queries spot price', async () => {
      const c = await bondingCurveHandler.create({
        curveType: 'linear', params: { slope: 0.01, intercept: 1 },
        reserveToken: 'ETH', bondedToken: 'GOV',
      }, storage);
      const result = await bondingCurveHandler.getPrice({
        curve: c.curve, amount: 10,
      }, storage);
      expect(result.variant).toBe('price');
      expect(result.spotPrice).toBeGreaterThan(0);
    });
  });
});
