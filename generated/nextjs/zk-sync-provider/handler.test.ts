// ZkSyncProvider — handler.test.ts
// Unit tests for zkSync Era provider register, poll, checkFinality, and getBatchProof actions.

import { describe, it, expect } from 'vitest';
import * as E from 'fp-ts/Either';

import { zkSyncProviderHandler } from './handler.js';
import type { ZkSyncProviderStorage } from './types.js';

const createTestStorage = (): ZkSyncProviderStorage => {
  const store = new Map<string, Map<string, Record<string, unknown>>>();
  return {
    get: async (relation, key) => store.get(relation)?.get(key) ?? null,
    put: async (relation, key, value) => {
      if (!store.has(relation)) store.set(relation, new Map());
      store.get(relation)!.set(key, value);
    },
    delete: async (relation, key) => store.get(relation)?.delete(key) ?? false,
    find: async (relation, filter?) => {
      const all = [...(store.get(relation)?.values() ?? [])];
      if (!filter) return all;
      return all.filter((record) =>
        Object.entries(filter).every(([k, v]) => record[k] === v),
      );
    },
  };
};

const createFailingStorage = (): ZkSyncProviderStorage => ({
  get: async () => { throw new Error('storage failure'); },
  put: async () => { throw new Error('storage failure'); },
  delete: async () => { throw new Error('storage failure'); },
  find: async () => { throw new Error('storage failure'); },
});

describe('ZkSyncProvider handler', () => {
  describe('register', () => {
    it('registers a new provider with ok variant', async () => {
      const storage = createTestStorage();
      const result = await zkSyncProviderHandler.register(
        { rpc_url: 'https://mainnet.era.zksync.io', diamond_proxy: '0xdiamond' },
        storage,
      )();
      expect(E.isRight(result)).toBe(true);
      if (E.isRight(result)) {
        expect(result.right.variant).toBe('ok');
        expect((result.right as any).provider).toBeDefined();
      }
    });

    it('returns already_registered for duplicate rpc_url', async () => {
      const storage = createTestStorage();
      await zkSyncProviderHandler.register(
        { rpc_url: 'https://mainnet.era.zksync.io', diamond_proxy: '0xdiamond' },
        storage,
      )();
      const result = await zkSyncProviderHandler.register(
        { rpc_url: 'https://mainnet.era.zksync.io', diamond_proxy: '0xdiamond2' },
        storage,
      )();
      expect(E.isRight(result)).toBe(true);
      if (E.isRight(result)) {
        expect(result.right.variant).toBe('already_registered');
      }
    });

    it('propagates storage errors', async () => {
      const storage = createFailingStorage();
      const result = await zkSyncProviderHandler.register(
        { rpc_url: 'https://zk.io', diamond_proxy: '0x1' },
        storage,
      )();
      expect(E.isLeft(result)).toBe(true);
    });
  });

  describe('poll', () => {
    it('polls existing provider returning ok with batch info', async () => {
      const storage = createTestStorage();
      const regResult = await zkSyncProviderHandler.register(
        { rpc_url: 'https://zk1.io', diamond_proxy: '0xdiamond' },
        storage,
      )();
      const providerId = (regResult as any).right.provider;

      const result = await zkSyncProviderHandler.poll(
        { provider: providerId },
        storage,
      )();
      expect(E.isRight(result)).toBe(true);
      if (E.isRight(result)) {
        expect(result.right.variant).toBe('ok');
        expect((result.right as any).block_number).toBeGreaterThan(0);
        expect((result.right as any).committed_batch).toBeDefined();
      }
    });

    it('returns notfound for non-existent provider', async () => {
      const storage = createTestStorage();
      const result = await zkSyncProviderHandler.poll(
        { provider: 'nonexistent' },
        storage,
      )();
      expect(E.isRight(result)).toBe(true);
      if (E.isRight(result)) {
        expect(result.right.variant).toBe('notfound');
      }
    });

    it('propagates storage errors', async () => {
      const storage = createFailingStorage();
      const result = await zkSyncProviderHandler.poll(
        { provider: 'any' },
        storage,
      )();
      expect(E.isLeft(result)).toBe(true);
    });
  });

  describe('checkFinality', () => {
    it('checks finality for existing provider', async () => {
      const storage = createTestStorage();
      const regResult = await zkSyncProviderHandler.register(
        { rpc_url: 'https://zk2.io', diamond_proxy: '0xdiamond' },
        storage,
      )();
      const providerId = (regResult as any).right.provider;

      const result = await zkSyncProviderHandler.checkFinality(
        { provider: providerId, tx_hash: '0xabcd1234' },
        storage,
      )();
      expect(E.isRight(result)).toBe(true);
      if (E.isRight(result)) {
        expect(['executed', 'proven', 'committed', 'pending']).toContain(
          result.right.variant,
        );
      }
    });

    it('returns notfound for non-existent provider', async () => {
      const storage = createTestStorage();
      const result = await zkSyncProviderHandler.checkFinality(
        { provider: 'nonexistent', tx_hash: '0xabc' },
        storage,
      )();
      expect(E.isRight(result)).toBe(true);
      if (E.isRight(result)) {
        expect(result.right.variant).toBe('notfound');
      }
    });
  });

  describe('getBatchProof', () => {
    it('returns ok with proof for existing batch', async () => {
      const storage = createTestStorage();
      const regResult = await zkSyncProviderHandler.register(
        { rpc_url: 'https://zk3.io', diamond_proxy: '0xdiamond' },
        storage,
      )();
      const providerId = (regResult as any).right.provider;

      // Poll to set last_batch > 0
      await zkSyncProviderHandler.poll({ provider: providerId }, storage)();

      const result = await zkSyncProviderHandler.getBatchProof(
        { provider: providerId, batch_number: 1 },
        storage,
      )();
      expect(E.isRight(result)).toBe(true);
      if (E.isRight(result)) {
        expect(result.right.variant).toBe('ok');
        expect((result.right as any).proof).toBeDefined();
        expect((result.right as any).verification_key).toBeDefined();
      }
    });

    it('returns not_proven for batch beyond last_batch', async () => {
      const storage = createTestStorage();
      const regResult = await zkSyncProviderHandler.register(
        { rpc_url: 'https://zk4.io', diamond_proxy: '0xdiamond' },
        storage,
      )();
      const providerId = (regResult as any).right.provider;

      const result = await zkSyncProviderHandler.getBatchProof(
        { provider: providerId, batch_number: 999999 },
        storage,
      )();
      expect(E.isRight(result)).toBe(true);
      if (E.isRight(result)) {
        expect(result.right.variant).toBe('not_proven');
      }
    });

    it('returns notfound for non-existent provider', async () => {
      const storage = createTestStorage();
      const result = await zkSyncProviderHandler.getBatchProof(
        { provider: 'nonexistent', batch_number: 1 },
        storage,
      )();
      expect(E.isRight(result)).toBe(true);
      if (E.isRight(result)) {
        expect(result.right.variant).toBe('notfound');
      }
    });
  });

  describe('multi-step sequence: register -> poll -> checkFinality -> getBatchProof', () => {
    it('completes full provider lifecycle', async () => {
      const storage = createTestStorage();

      const regResult = await zkSyncProviderHandler.register(
        { rpc_url: 'https://zk-full.io', diamond_proxy: '0xdiamond' },
        storage,
      )();
      expect(E.isRight(regResult)).toBe(true);
      const providerId = (regResult as any).right.provider;

      const pollResult = await zkSyncProviderHandler.poll(
        { provider: providerId },
        storage,
      )();
      expect(E.isRight(pollResult)).toBe(true);

      const finalityResult = await zkSyncProviderHandler.checkFinality(
        { provider: providerId, tx_hash: '0x12345678' },
        storage,
      )();
      expect(E.isRight(finalityResult)).toBe(true);

      const proofResult = await zkSyncProviderHandler.getBatchProof(
        { provider: providerId, batch_number: 1 },
        storage,
      )();
      expect(E.isRight(proofResult)).toBe(true);
      if (E.isRight(proofResult)) {
        expect(proofResult.right.variant).toBe('ok');
      }
    });
  });

  describe('storage failure', () => {
    it('propagates storage errors on getBatchProof', async () => {
      const storage = createFailingStorage();
      const result = await zkSyncProviderHandler.getBatchProof(
        { provider: 'any', batch_number: 1 },
        storage,
      )();
      expect(E.isLeft(result)).toBe(true);
    });
  });
});
