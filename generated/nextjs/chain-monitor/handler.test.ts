// ChainMonitor — handler.test.ts
// Unit tests for chainMonitor handler actions.

import { describe, it, expect } from 'vitest';
import * as TE from 'fp-ts/TaskEither';
import * as E from 'fp-ts/Either';
import { pipe } from 'fp-ts/function';

import { chainMonitorHandler } from './handler.js';
import type { ChainMonitorStorage } from './types.js';

// In-memory test storage
const createTestStorage = (): ChainMonitorStorage => {
  const store = new Map<string, Map<string, Record<string, unknown>>>();
  return {
    get: async (relation, key) => store.get(relation)?.get(key) ?? null,
    put: async (relation, key, value) => {
      if (!store.has(relation)) store.set(relation, new Map());
      store.get(relation)!.set(key, value);
    },
    delete: async (relation, key) => store.get(relation)?.delete(key) ?? false,
    find: async (relation) => [...(store.get(relation)?.values() ?? [])],
  };
};

// Failing storage for error propagation tests
const createFailingStorage = (): ChainMonitorStorage => ({
  get: async () => { throw new Error('storage failure'); },
  put: async () => { throw new Error('storage failure'); },
  delete: async () => { throw new Error('storage failure'); },
  find: async () => { throw new Error('storage failure'); },
});

describe('ChainMonitor handler', () => {
  describe('awaitFinality', () => {
    it('should return ok when transaction has enough confirmations', async () => {
      const storage = createTestStorage();
      await storage.put('tx', '0xabc', { blockNumber: 100, chainId: '1' });
      await storage.put('chain_state', '1', { latestBlock: 112 });

      const result = await chainMonitorHandler.awaitFinality(
        { txHash: '0xabc', level: 'finalized' },
        storage,
      )();

      expect(E.isRight(result)).toBe(true);
      if (E.isRight(result)) {
        expect(result.right.variant).toBe('ok');
        if (result.right.variant === 'ok') {
          expect(result.right.confirmations).toBeGreaterThanOrEqual(12);
        }
      }
    });

    it('should return timeout when transaction is not found', async () => {
      const storage = createTestStorage();

      const result = await chainMonitorHandler.awaitFinality(
        { txHash: '0xnonexistent', level: 'safe' },
        storage,
      )();

      expect(E.isRight(result)).toBe(true);
      if (E.isRight(result)) {
        expect(result.right.variant).toBe('timeout');
      }
    });

    it('should return timeout when not enough confirmations', async () => {
      const storage = createTestStorage();
      await storage.put('tx', '0xabc', { blockNumber: 100, chainId: '1' });
      await storage.put('chain_state', '1', { latestBlock: 102 });

      const result = await chainMonitorHandler.awaitFinality(
        { txHash: '0xabc', level: 'safe' },
        storage,
      )();

      expect(E.isRight(result)).toBe(true);
      if (E.isRight(result)) {
        expect(result.right.variant).toBe('timeout');
      }
    });

    it('should return reorged when block was reorged', async () => {
      const storage = createTestStorage();
      await storage.put('tx', '0xabc', { blockNumber: 100, chainId: '1' });
      await storage.put('chain_state', '1', { latestBlock: 120 });
      await storage.put('reorg', '1_100', { depth: 3 });

      const result = await chainMonitorHandler.awaitFinality(
        { txHash: '0xabc', level: 'safe' },
        storage,
      )();

      expect(E.isRight(result)).toBe(true);
      if (E.isRight(result)) {
        expect(result.right.variant).toBe('reorged');
      }
    });

    it('should return Left on storage failure', async () => {
      const storage = createFailingStorage();

      const result = await chainMonitorHandler.awaitFinality(
        { txHash: '0xabc', level: 'safe' },
        storage,
      )();

      expect(E.isLeft(result)).toBe(true);
    });
  });

  describe('subscribe', () => {
    it('should return ok with valid RPC URL', async () => {
      const storage = createTestStorage();

      const result = await chainMonitorHandler.subscribe(
        { chainId: 1, rpcUrl: 'https://eth-mainnet.rpc.io' },
        storage,
      )();

      expect(E.isRight(result)).toBe(true);
      if (E.isRight(result)) {
        expect(result.right.variant).toBe('ok');
        if (result.right.variant === 'ok') {
          expect(result.right.chainId).toBe(1);
        }
      }
    });

    it('should return error with invalid RPC URL', async () => {
      const storage = createTestStorage();

      const result = await chainMonitorHandler.subscribe(
        { chainId: 1, rpcUrl: 'invalid-url' },
        storage,
      )();

      expect(E.isRight(result)).toBe(true);
      if (E.isRight(result)) {
        expect(result.right.variant).toBe('error');
      }
    });

    it('should return Left on storage failure', async () => {
      const storage = createFailingStorage();

      const result = await chainMonitorHandler.subscribe(
        { chainId: 1, rpcUrl: 'https://eth-mainnet.rpc.io' },
        storage,
      )();

      expect(E.isLeft(result)).toBe(true);
    });
  });

  describe('onBlock', () => {
    it('should return ok for normal block progression', async () => {
      const storage = createTestStorage();
      await storage.put('chain_state', '1', { latestBlock: 99, latestHash: '0xprev' });

      const result = await chainMonitorHandler.onBlock(
        { chainId: 1, blockNumber: 100, blockHash: '0xnew' },
        storage,
      )();

      expect(E.isRight(result)).toBe(true);
      if (E.isRight(result)) {
        expect(result.right.variant).toBe('ok');
        if (result.right.variant === 'ok') {
          expect(result.right.blockNumber).toBe(100);
        }
      }
    });

    it('should return reorg when block number goes backwards', async () => {
      const storage = createTestStorage();
      await storage.put('chain_state', '1', { latestBlock: 105, latestHash: '0xprev' });

      const result = await chainMonitorHandler.onBlock(
        { chainId: 1, blockNumber: 100, blockHash: '0xfork' },
        storage,
      )();

      expect(E.isRight(result)).toBe(true);
      if (E.isRight(result)) {
        expect(result.right.variant).toBe('reorg');
        if (result.right.variant === 'reorg') {
          expect(result.right.depth).toBe(6);
          expect(result.right.fromBlock).toBe(100);
        }
      }
    });

    it('should return Left on storage failure', async () => {
      const storage = createFailingStorage();

      const result = await chainMonitorHandler.onBlock(
        { chainId: 1, blockNumber: 100, blockHash: '0xnew' },
        storage,
      )();

      expect(E.isLeft(result)).toBe(true);
    });
  });
});
