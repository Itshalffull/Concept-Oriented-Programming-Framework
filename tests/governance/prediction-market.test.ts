// ============================================================
// Prediction Market Concept Conformance Tests
//
// Tests for market creation, trading, resolution, and payouts.
// ============================================================

import { describe, it, expect, beforeEach } from 'vitest';
import { createInMemoryStorage } from '../../runtime/adapters/storage.js';
import { predictionMarketHandler } from '../../handlers/ts/app/governance/prediction-market.handler.js';

describe('Prediction Market Handler', () => {
  let storage: ReturnType<typeof createInMemoryStorage>;

  beforeEach(() => {
    storage = createInMemoryStorage();
  });

  describe('createMarket', () => {
    it('creates a prediction market', async () => {
      const result = await predictionMarketHandler.createMarket({
        question: 'Will proposal pass?', outcomes: ['yes', 'no'],
        resolution: 'oracle', liquidity: 1000,
      }, storage);
      expect(result.variant).toBe('created');
      expect(result.market).toBeDefined();
    });
  });

  describe('trade', () => {
    it('executes a trade', async () => {
      const m = await predictionMarketHandler.createMarket({
        question: 'Test?', outcomes: ['A', 'B'], resolution: 'oracle', liquidity: 1000,
      }, storage);
      const result = await predictionMarketHandler.trade({
        market: m.market, trader: 'alice', outcome: 'A', amount: 100,
      }, storage);
      expect(result.variant).toBe('traded');
    });

    it('rejects trade on closed market', async () => {
      const m = await predictionMarketHandler.createMarket({
        question: 'Test?', outcomes: ['A', 'B'], resolution: 'oracle', liquidity: 1000,
      }, storage);
      await predictionMarketHandler.resolve({ market: m.market, winningOutcome: 'A' }, storage);
      const result = await predictionMarketHandler.trade({
        market: m.market, trader: 'bob', outcome: 'A', amount: 50,
      }, storage);
      expect(result.variant).toBe('market_closed');
    });
  });

  describe('resolve', () => {
    it('resolves a market with a winning outcome', async () => {
      const m = await predictionMarketHandler.createMarket({
        question: 'Will it rain?', outcomes: ['yes', 'no'],
        resolution: 'oracle', liquidity: 500,
      }, storage);
      const result = await predictionMarketHandler.resolve({
        market: m.market, winningOutcome: 'yes',
      }, storage);
      expect(result.variant).toBe('resolved');
    });
  });

  describe('claimPayout', () => {
    it('claims payout after resolution', async () => {
      const m = await predictionMarketHandler.createMarket({
        question: 'Test?', outcomes: ['A', 'B'], resolution: 'oracle', liquidity: 1000,
      }, storage);
      await predictionMarketHandler.trade({ market: m.market, trader: 'alice', outcome: 'A', amount: 100 }, storage);
      await predictionMarketHandler.resolve({ market: m.market, winningOutcome: 'A' }, storage);
      const result = await predictionMarketHandler.claimPayout({
        market: m.market, trader: 'alice',
      }, storage);
      expect(result.variant).toBe('claimed');
    });
  });
});
