// AbiDecoderFieldMapping — handler.test.ts
// Unit tests for ABI decoder field mapping apply, reverse, and register actions.

import { describe, it, expect } from 'vitest';
import * as E from 'fp-ts/Either';

import { abiDecoderFieldMappingHandler } from './handler.js';
import type { AbiDecoderFieldMappingStorage } from './types.js';

const createTestStorage = (): AbiDecoderFieldMappingStorage => {
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

const createFailingStorage = (): AbiDecoderFieldMappingStorage => ({
  get: async () => { throw new Error('storage failure'); },
  put: async () => { throw new Error('storage failure'); },
  delete: async () => { throw new Error('storage failure'); },
  find: async () => { throw new Error('storage failure'); },
});

const seedMapper = async (storage: AbiDecoderFieldMappingStorage, id: string) => {
  await storage.put('abi_decoder_field_mapping', id, {
    id,
    contract_abi: '[]',
    entity_schema: 'Token',
    field_rules: '{"amount":"uint256","recipient":"address"}',
    status: 'active',
  });
};

describe('AbiDecoderFieldMapping handler', () => {
  describe('apply', () => {
    it('applies mapping to decode data with ok variant', async () => {
      const storage = createTestStorage();
      await seedMapper(storage, 'mapper-1');

      const result = await abiDecoderFieldMappingHandler.apply(
        { data: '0xabcdef', mapper: 'mapper-1', contract: '0x1234' },
        storage,
      )();
      expect(E.isRight(result)).toBe(true);
      if (E.isRight(result)) {
        expect(result.right.variant).toBe('ok');
        expect((result.right as any).mapped).toBeDefined();
      }
    });

    it('returns notfound for non-existent mapper', async () => {
      const storage = createTestStorage();
      const result = await abiDecoderFieldMappingHandler.apply(
        { data: '0x00', mapper: 'nonexistent', contract: '0x1234' },
        storage,
      )();
      expect(E.isRight(result)).toBe(true);
      if (E.isRight(result)) {
        expect(result.right.variant).toBe('notfound');
      }
    });

    it('propagates storage errors', async () => {
      const storage = createFailingStorage();
      const result = await abiDecoderFieldMappingHandler.apply(
        { data: '0x00', mapper: 'mapper-1', contract: '0x1234' },
        storage,
      )();
      expect(E.isLeft(result)).toBe(true);
    });
  });

  describe('reverse', () => {
    it('reverses entity data to ABI-encoded format with ok variant', async () => {
      const storage = createTestStorage();
      await seedMapper(storage, 'mapper-1');

      const result = await abiDecoderFieldMappingHandler.reverse(
        { data: '{"amount":100,"recipient":"0xabc"}', mapper: 'mapper-1' },
        storage,
      )();
      expect(E.isRight(result)).toBe(true);
      if (E.isRight(result)) {
        expect(result.right.variant).toBe('ok');
        expect((result.right as any).encoded).toMatch(/^0x/);
      }
    });

    it('returns notfound for non-existent mapper', async () => {
      const storage = createTestStorage();
      const result = await abiDecoderFieldMappingHandler.reverse(
        { data: '{}', mapper: 'nonexistent' },
        storage,
      )();
      expect(E.isRight(result)).toBe(true);
      if (E.isRight(result)) {
        expect(result.right.variant).toBe('notfound');
      }
    });

    it('returns error for invalid entity data JSON', async () => {
      const storage = createTestStorage();
      await seedMapper(storage, 'mapper-1');

      const result = await abiDecoderFieldMappingHandler.reverse(
        { data: 'not-json', mapper: 'mapper-1' },
        storage,
      )();
      expect(E.isRight(result)).toBe(true);
      if (E.isRight(result)) {
        expect(result.right.variant).toBe('error');
      }
    });
  });

  describe('register', () => {
    it('registers a new mapping with ok variant', async () => {
      const storage = createTestStorage();
      const result = await abiDecoderFieldMappingHandler.register(
        {
          contract_abi: '[{"type":"function","name":"transfer"}]',
          entity_schema: 'Token',
          field_rules: '{"amount":"uint256"}',
        },
        storage,
      )();
      expect(E.isRight(result)).toBe(true);
      if (E.isRight(result)) {
        expect(result.right.variant).toBe('ok');
        expect((result.right as any).mapper).toBeDefined();
      }
    });

    it('returns invalid for bad contract_abi JSON', async () => {
      const storage = createTestStorage();
      const result = await abiDecoderFieldMappingHandler.register(
        {
          contract_abi: 'not-json',
          entity_schema: 'Token',
          field_rules: '{}',
        },
        storage,
      )();
      expect(E.isRight(result)).toBe(true);
      if (E.isRight(result)) {
        expect(result.right.variant).toBe('invalid');
      }
    });

    it('returns invalid for bad field_rules JSON', async () => {
      const storage = createTestStorage();
      const result = await abiDecoderFieldMappingHandler.register(
        {
          contract_abi: '[]',
          entity_schema: 'Token',
          field_rules: 'not-json',
        },
        storage,
      )();
      expect(E.isRight(result)).toBe(true);
      if (E.isRight(result)) {
        expect(result.right.variant).toBe('invalid');
      }
    });

    it('propagates storage errors', async () => {
      const storage = createFailingStorage();
      const result = await abiDecoderFieldMappingHandler.register(
        {
          contract_abi: '[]',
          entity_schema: 'Token',
          field_rules: '{}',
        },
        storage,
      )();
      expect(E.isLeft(result)).toBe(true);
    });
  });

  describe('multi-step sequence: register -> apply -> reverse', () => {
    it('completes full mapping lifecycle', async () => {
      const storage = createTestStorage();

      const regResult = await abiDecoderFieldMappingHandler.register(
        {
          contract_abi: '[{"type":"function","name":"mint"}]',
          entity_schema: 'NFT',
          field_rules: '{"tokenId":"uint256","owner":"address"}',
        },
        storage,
      )();
      expect(E.isRight(regResult)).toBe(true);
      const mapperId = (regResult as any).right.mapper;

      const applyResult = await abiDecoderFieldMappingHandler.apply(
        { data: '0x1234', mapper: mapperId, contract: '0xNFT' },
        storage,
      )();
      expect(E.isRight(applyResult)).toBe(true);
      if (E.isRight(applyResult)) {
        expect(applyResult.right.variant).toBe('ok');
      }

      const reverseResult = await abiDecoderFieldMappingHandler.reverse(
        { data: '{"tokenId":42}', mapper: mapperId },
        storage,
      )();
      expect(E.isRight(reverseResult)).toBe(true);
      if (E.isRight(reverseResult)) {
        expect(reverseResult.right.variant).toBe('ok');
      }
    });
  });
});
