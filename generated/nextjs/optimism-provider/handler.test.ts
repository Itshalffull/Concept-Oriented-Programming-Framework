// OptimismProvider — handler.test.ts
// Unit tests for Optimism L2 provider register, poll, checkFinality, and relayMessage actions.

import { describe, it, expect } from 'vitest';
import * as E from 'fp-ts/Either';

import { optimismProviderHandler } from './handler.js';
import type { OptimismProviderStorage } from './types.js';

const createTestStorage = (): OptimismProviderStorage => {
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

const createFailingStorage = (): OptimismProviderStorage => ({
  get: async () => { throw new Error('storage failure'); },
  put: async () => { throw new Error('storage failure'); },
  delete: async () => { throw new Error('storage failure'); },
  find: async () => { throw new Error('storage failure'); },
});

describe('OptimismProvider handler', () => {
  describe('register', () => {
    it('registers a new provider with ok variant', async () => {
      const storage = createTestStorage();
      const result = await optimismProviderHandler.register(
        { rpc_url: 'https://mainnet.optimism.io', l1_bridge_address: '0xbridge' },
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
      await optimismProviderHandler.register(
        { rpc_url: 'https://mainnet.optimism.io', l1_bridge_address: '0xbridge' },
        storage,
      )();
      const result = await optimismProviderHandler.register(
        { rpc_url: 'https://mainnet.optimism.io', l1_bridge_address: '0xbridge2' },
        storage,
      )();
      expect(E.isRight(result)).toBe(true);
      if (E.isRight(result)) {
        expect(result.right.variant).toBe('already_registered');
      }
    });

    it('propagates storage errors', async () => {
      const storage = createFailingStorage();
      const result = await optimismProviderHandler.register(
        { rpc_url: 'https://op.io', l1_bridge_address: '0x1' },
        storage,
      )();
      expect(E.isLeft(result)).toBe(true);
    });
  });

  describe('poll', () => {
    it('polls existing provider returning ok with block info', async () => {
      const storage = createTestStorage();
      const regResult = await optimismProviderHandler.register(
        { rpc_url: 'https://op.io', l1_bridge_address: '0xbridge' },
        storage,
      )();
      const providerId = (regResult as any).right.provider;

      const result = await optimismProviderHandler.poll(
        { provider: providerId },
        storage,
      )();
      expect(E.isRight(result)).toBe(true);
      if (E.isRight(result)) {
        expect(result.right.variant).toBe('ok');
        expect((result.right as any).block_number).toBeGreaterThan(0);
      }
    });

    it('returns notfound for non-existent provider', async () => {
      const storage = createTestStorage();
      const result = await optimismProviderHandler.poll(
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
      const result = await optimismProviderHandler.poll(
        { provider: 'any' },
        storage,
      )();
      expect(E.isLeft(result)).toBe(true);
    });
  });

  describe('checkFinality', () => {
    it('checks finality for existing provider', async () => {
      const storage = createTestStorage();
      const regResult = await optimismProviderHandler.register(
        { rpc_url: 'https://op2.io', l1_bridge_address: '0xbridge' },
        storage,
      )();
      const providerId = (regResult as any).right.provider;

      // Use even-length hash to get finalized
      const result = await optimismProviderHandler.checkFinality(
        { provider: providerId, tx_hash: '0xabcd' },
        storage,
      )();
      expect(E.isRight(result)).toBe(true);
      if (E.isRight(result)) {
        expect(['finalized', 'pending']).toContain(result.right.variant);
      }
    });

    it('returns notfound for non-existent provider', async () => {
      const storage = createTestStorage();
      const result = await optimismProviderHandler.checkFinality(
        { provider: 'nonexistent', tx_hash: '0xabc' },
        storage,
      )();
      expect(E.isRight(result)).toBe(true);
      if (E.isRight(result)) {
        expect(result.right.variant).toBe('notfound');
      }
    });
  });

  describe('relayMessage', () => {
    it('relays a message returning ok with l1_tx_hash', async () => {
      const storage = createTestStorage();
      const regResult = await optimismProviderHandler.register(
        { rpc_url: 'https://op3.io', l1_bridge_address: '0xbridge' },
        storage,
      )();
      const providerId = (regResult as any).right.provider;

      const result = await optimismProviderHandler.relayMessage(
        { provider: providerId, message_hash: '0xmsg123' },
        storage,
      )();
      expect(E.isRight(result)).toBe(true);
      if (E.isRight(result)) {
        expect(result.right.variant).toBe('ok');
        expect((result.right as any).l1_tx_hash).toMatch(/^0x/);
      }
    });

    it('returns already_relayed for duplicate message', async () => {
      const storage = createTestStorage();
      const regResult = await optimismProviderHandler.register(
        { rpc_url: 'https://op4.io', l1_bridge_address: '0xbridge' },
        storage,
      )();
      const providerId = (regResult as any).right.provider;

      await optimismProviderHandler.relayMessage(
        { provider: providerId, message_hash: '0xmsg456' },
        storage,
      )();
      const result = await optimismProviderHandler.relayMessage(
        { provider: providerId, message_hash: '0xmsg456' },
        storage,
      )();
      expect(E.isRight(result)).toBe(true);
      if (E.isRight(result)) {
        expect(result.right.variant).toBe('already_relayed');
      }
    });

    it('returns error for non-existent provider', async () => {
      const storage = createTestStorage();
      const result = await optimismProviderHandler.relayMessage(
        { provider: 'nonexistent', message_hash: '0xmsg' },
        storage,
      )();
      expect(E.isRight(result)).toBe(true);
      if (E.isRight(result)) {
        expect(result.right.variant).toBe('error');
      }
    });
  });

  describe('multi-step sequence: register -> poll -> checkFinality -> relayMessage', () => {
    it('completes full provider lifecycle', async () => {
      const storage = createTestStorage();

      const regResult = await optimismProviderHandler.register(
        { rpc_url: 'https://op-full.io', l1_bridge_address: '0xbridge' },
        storage,
      )();
      expect(E.isRight(regResult)).toBe(true);
      const providerId = (regResult as any).right.provider;

      const pollResult = await optimismProviderHandler.poll(
        { provider: providerId },
        storage,
      )();
      expect(E.isRight(pollResult)).toBe(true);

      const finalityResult = await optimismProviderHandler.checkFinality(
        { provider: providerId, tx_hash: '0xabcdef12' },
        storage,
      )();
      expect(E.isRight(finalityResult)).toBe(true);

      const relayResult = await optimismProviderHandler.relayMessage(
        { provider: providerId, message_hash: '0xrelay1' },
        storage,
      )();
      expect(E.isRight(relayResult)).toBe(true);
      if (E.isRight(relayResult)) {
        expect(relayResult.right.variant).toBe('ok');
      }
    });
  });

  describe('storage failure', () => {
    it('propagates storage errors on relayMessage', async () => {
      const storage = createFailingStorage();
      const result = await optimismProviderHandler.relayMessage(
        { provider: 'any', message_hash: '0x1' },
        storage,
      )();
      expect(E.isLeft(result)).toBe(true);
    });
  });
});
