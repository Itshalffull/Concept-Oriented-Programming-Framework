// EthereumL2Connector — handler.test.ts
// fp-ts handler tests for L2 connector read, write, test, discover actions.

import { describe, it, expect } from 'vitest';
import * as E from 'fp-ts/Either';

import { ethereumL2ConnectorHandler } from './handler.js';
import type { EthereumL2ConnectorStorage } from './types.js';

const createTestStorage = (): EthereumL2ConnectorStorage => {
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

const createFailingStorage = (): EthereumL2ConnectorStorage => ({
  get: async () => { throw new Error('storage failure'); },
  put: async () => { throw new Error('storage failure'); },
  delete: async () => { throw new Error('storage failure'); },
  find: async () => { throw new Error('storage failure'); },
});

const seedConnector = async (storage: EthereumL2ConnectorStorage) => {
  await storage.put('ethereum_l2_connector', 'conn-1', {
    id: 'conn-1',
    chain_id: 42161,
    contract_address: '0xabcdef1234567890abcdef1234567890abcdef12',
    rpc_url: 'https://arb1.arbitrum.io/rpc',
    status: 'disconnected',
    abi: JSON.stringify([
      { type: 'function', name: 'balanceOf', inputs: [], outputs: [] },
      { type: 'function', name: 'transfer', inputs: [], outputs: [] },
      { type: 'event', name: 'Transfer', inputs: [] },
      { type: 'event', name: 'Approval', inputs: [] },
    ]),
  });
};

describe('EthereumL2Connector handler (fp-ts)', () => {
  describe('read', () => {
    it('returns ok with data for valid connector and query', async () => {
      const storage = createTestStorage();
      await seedConnector(storage);

      const result = await ethereumL2ConnectorHandler.read(
        { connector: 'conn-1', query: '{"method":"eth_call","params":[]}' },
        storage,
      )();
      expect(E.isRight(result)).toBe(true);
      if (E.isRight(result)) {
        expect(result.right.variant).toBe('ok');
        const data = JSON.parse((result.right as any).data);
        expect(data.result).toBe('read_result_for_eth_call');
        expect(data.contract).toBe('0xabcdef1234567890abcdef1234567890abcdef12');
        expect(data.chain_id).toBe(42161);
      }
    });

    it('returns notfound for missing connector', async () => {
      const storage = createTestStorage();

      const result = await ethereumL2ConnectorHandler.read(
        { connector: 'nonexistent', query: '{"method":"eth_call"}' },
        storage,
      )();
      expect(E.isRight(result)).toBe(true);
      if (E.isRight(result)) {
        expect(result.right.variant).toBe('notfound');
        expect((result.right as any).connector).toBe('nonexistent');
      }
    });

    it('returns error for invalid query JSON', async () => {
      const storage = createTestStorage();
      await seedConnector(storage);

      const result = await ethereumL2ConnectorHandler.read(
        { connector: 'conn-1', query: 'not-valid-json{{{' },
        storage,
      )();
      expect(E.isRight(result)).toBe(true);
      if (E.isRight(result)) {
        expect(result.right.variant).toBe('error');
        expect((result.right as any).message).toBe('Invalid query JSON');
      }
    });

    it('propagates storage errors as Left', async () => {
      const storage = createFailingStorage();
      const result = await ethereumL2ConnectorHandler.read(
        { connector: 'conn-1', query: '{}' },
        storage,
      )();
      expect(E.isLeft(result)).toBe(true);
      if (E.isLeft(result)) {
        expect(result.left.code).toBe('STORAGE_ERROR');
        expect(result.left.message).toBe('storage failure');
      }
    });
  });

  describe('write', () => {
    it('returns ok with tx_hash for valid connector and data', async () => {
      const storage = createTestStorage();
      await seedConnector(storage);

      const result = await ethereumL2ConnectorHandler.write(
        { connector: 'conn-1', data: '{"to":"0x123","value":"100"}' },
        storage,
      )();
      expect(E.isRight(result)).toBe(true);
      if (E.isRight(result)) {
        expect(result.right.variant).toBe('ok');
        expect((result.right as any).tx_hash).toBeDefined();
        expect((result.right as any).tx_hash).toMatch(/^0x/);
      }
    });

    it('returns notfound for missing connector', async () => {
      const storage = createTestStorage();

      const result = await ethereumL2ConnectorHandler.write(
        { connector: 'nonexistent', data: '{"to":"0x123"}' },
        storage,
      )();
      expect(E.isRight(result)).toBe(true);
      if (E.isRight(result)) {
        expect(result.right.variant).toBe('notfound');
        expect((result.right as any).connector).toBe('nonexistent');
      }
    });

    it('returns error for invalid data JSON', async () => {
      const storage = createTestStorage();
      await seedConnector(storage);

      const result = await ethereumL2ConnectorHandler.write(
        { connector: 'conn-1', data: '<<<invalid>>>' },
        storage,
      )();
      expect(E.isRight(result)).toBe(true);
      if (E.isRight(result)) {
        expect(result.right.variant).toBe('error');
        expect((result.right as any).message).toBe('Invalid data JSON');
      }
    });

    it('propagates storage errors as Left', async () => {
      const storage = createFailingStorage();
      const result = await ethereumL2ConnectorHandler.write(
        { connector: 'conn-1', data: '{}' },
        storage,
      )();
      expect(E.isLeft(result)).toBe(true);
      if (E.isLeft(result)) {
        expect(result.left.code).toBe('STORAGE_ERROR');
        expect(result.left.message).toBe('storage failure');
      }
    });
  });

  describe('test', () => {
    it('returns ok with block_number and latency_ms for existing connector', async () => {
      const storage = createTestStorage();
      await seedConnector(storage);

      const result = await ethereumL2ConnectorHandler.test(
        { connector: 'conn-1' },
        storage,
      )();
      expect(E.isRight(result)).toBe(true);
      if (E.isRight(result)) {
        expect(result.right.variant).toBe('ok');
        expect((result.right as any).block_number).toBeTypeOf('number');
        expect((result.right as any).latency_ms).toBeTypeOf('number');
      }
    });

    it('updates connector status to connected after test', async () => {
      const storage = createTestStorage();
      await seedConnector(storage);

      await ethereumL2ConnectorHandler.test(
        { connector: 'conn-1' },
        storage,
      )();

      const updated = await storage.get('ethereum_l2_connector', 'conn-1');
      expect(updated).not.toBeNull();
      expect(updated!['status']).toBe('connected');
    });

    it('returns unreachable for missing connector', async () => {
      const storage = createTestStorage();

      const result = await ethereumL2ConnectorHandler.test(
        { connector: 'nonexistent' },
        storage,
      )();
      expect(E.isRight(result)).toBe(true);
      if (E.isRight(result)) {
        expect(result.right.variant).toBe('unreachable');
        expect((result.right as any).message).toContain('nonexistent');
      }
    });

    it('propagates storage errors as Left', async () => {
      const storage = createFailingStorage();
      const result = await ethereumL2ConnectorHandler.test(
        { connector: 'conn-1' },
        storage,
      )();
      expect(E.isLeft(result)).toBe(true);
      if (E.isLeft(result)) {
        expect(result.left.code).toBe('STORAGE_ERROR');
        expect(result.left.message).toBe('storage failure');
      }
    });
  });

  describe('discover', () => {
    it('returns ok with functions and events for existing connector with ABI', async () => {
      const storage = createTestStorage();
      await seedConnector(storage);

      const result = await ethereumL2ConnectorHandler.discover(
        { connector: 'conn-1' },
        storage,
      )();
      expect(E.isRight(result)).toBe(true);
      if (E.isRight(result)) {
        expect(result.right.variant).toBe('ok');
        expect((result.right as any).functions).toEqual(['balanceOf', 'transfer']);
        expect((result.right as any).events).toEqual(['Transfer', 'Approval']);
      }
    });

    it('returns ok with empty arrays for connector without ABI', async () => {
      const storage = createTestStorage();
      await storage.put('ethereum_l2_connector', 'conn-no-abi', {
        id: 'conn-no-abi',
        chain_id: 10,
        contract_address: '0x0000000000000000000000000000000000000000',
        status: 'disconnected',
      });

      const result = await ethereumL2ConnectorHandler.discover(
        { connector: 'conn-no-abi' },
        storage,
      )();
      expect(E.isRight(result)).toBe(true);
      if (E.isRight(result)) {
        expect(result.right.variant).toBe('ok');
        expect((result.right as any).functions).toEqual([]);
        expect((result.right as any).events).toEqual([]);
      }
    });

    it('returns notfound for missing connector', async () => {
      const storage = createTestStorage();

      const result = await ethereumL2ConnectorHandler.discover(
        { connector: 'nonexistent' },
        storage,
      )();
      expect(E.isRight(result)).toBe(true);
      if (E.isRight(result)) {
        expect(result.right.variant).toBe('notfound');
        expect((result.right as any).connector).toBe('nonexistent');
      }
    });

    it('propagates storage errors as Left', async () => {
      const storage = createFailingStorage();
      const result = await ethereumL2ConnectorHandler.discover(
        { connector: 'conn-1' },
        storage,
      )();
      expect(E.isLeft(result)).toBe(true);
      if (E.isLeft(result)) {
        expect(result.left.code).toBe('STORAGE_ERROR');
        expect(result.left.message).toBe('storage failure');
      }
    });
  });

  describe('multi-step sequence: read -> write -> test -> discover', () => {
    it('completes full connector lifecycle', async () => {
      const storage = createTestStorage();
      await seedConnector(storage);

      // Read
      const readResult = await ethereumL2ConnectorHandler.read(
        { connector: 'conn-1', query: '{"method":"eth_blockNumber"}' },
        storage,
      )();
      expect(E.isRight(readResult)).toBe(true);
      if (E.isRight(readResult)) {
        expect(readResult.right.variant).toBe('ok');
      }

      // Write
      const writeResult = await ethereumL2ConnectorHandler.write(
        { connector: 'conn-1', data: '{"to":"0xabc","value":"50"}' },
        storage,
      )();
      expect(E.isRight(writeResult)).toBe(true);
      if (E.isRight(writeResult)) {
        expect(writeResult.right.variant).toBe('ok');
      }

      // Test
      const testResult = await ethereumL2ConnectorHandler.test(
        { connector: 'conn-1' },
        storage,
      )();
      expect(E.isRight(testResult)).toBe(true);
      if (E.isRight(testResult)) {
        expect(testResult.right.variant).toBe('ok');
      }

      // Discover
      const discoverResult = await ethereumL2ConnectorHandler.discover(
        { connector: 'conn-1' },
        storage,
      )();
      expect(E.isRight(discoverResult)).toBe(true);
      if (E.isRight(discoverResult)) {
        expect(discoverResult.right.variant).toBe('ok');
        expect((discoverResult.right as any).functions.length).toBeGreaterThan(0);
        expect((discoverResult.right as any).events.length).toBeGreaterThan(0);
      }
    });
  });
});
