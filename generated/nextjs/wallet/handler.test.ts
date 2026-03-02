// Wallet — handler.test.ts
import { describe, it, expect } from 'vitest';
import * as TE from 'fp-ts/TaskEither';
import * as E from 'fp-ts/Either';
import { pipe } from 'fp-ts/function';

import { walletHandler } from './handler.js';
import type { WalletStorage } from './types.js';

const createTestStorage = (): WalletStorage => {
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

const createFailingStorage = (): WalletStorage => ({
  get: async () => { throw new Error('storage failure'); },
  put: async () => { throw new Error('storage failure'); },
  delete: async () => { throw new Error('storage failure'); },
  find: async () => { throw new Error('storage failure'); },
});

const handler = walletHandler;

const VALID_ADDRESS = '0x' + 'a'.repeat(40);

describe('Wallet handler', () => {
  describe('verify', () => {
    it('should return error variant for invalid address format', async () => {
      const storage = createTestStorage();
      const result = await handler.verify(
        { address: 'invalid', message: 'test', signature: '0xsig' },
        storage,
      )();
      expect(E.isRight(result)).toBe(true);
      if (E.isRight(result)) {
        expect(result.right.variant).toBe('error');
      }
    });

    it('should return ok or invalid variant for valid address', async () => {
      const storage = createTestStorage();
      const result = await handler.verify(
        { address: VALID_ADDRESS, message: 'hello', signature: '0xdeadbeef' },
        storage,
      )();
      expect(E.isRight(result)).toBe(true);
      if (E.isRight(result)) {
        expect(['ok', 'invalid']).toContain(result.right.variant);
      }
    });

    it('should persist verification attempt to storage', async () => {
      const storage = createTestStorage();
      await handler.verify(
        { address: VALID_ADDRESS, message: 'hello', signature: '0xdeadbeef' },
        storage,
      )();
      const records = await storage.find('verification');
      expect(records.length).toBeGreaterThan(0);
      expect(records[0]['address']).toBe(VALID_ADDRESS);
    });

    it('should return left on storage failure', async () => {
      const storage = createFailingStorage();
      const result = await handler.verify(
        { address: VALID_ADDRESS, message: 'hello', signature: '0xdeadbeef' },
        storage,
      )();
      expect(E.isLeft(result)).toBe(true);
      if (E.isLeft(result)) {
        expect(result.left.code).toBe('STORAGE_ERROR');
      }
    });

    it('should return error variant for address with wrong length', async () => {
      const storage = createTestStorage();
      const result = await handler.verify(
        { address: '0xabc', message: 'test', signature: '0xsig' },
        storage,
      )();
      expect(E.isRight(result)).toBe(true);
      if (E.isRight(result)) {
        expect(result.right.variant).toBe('error');
      }
    });
  });

  describe('verifyTypedData', () => {
    it('should return error variant for invalid address', async () => {
      const storage = createTestStorage();
      const result = await handler.verifyTypedData(
        {
          address: 'bad',
          domain: '{}',
          types: '{}',
          value: '{}',
          signature: '0xsig',
        },
        storage,
      )();
      expect(E.isRight(result)).toBe(true);
      if (E.isRight(result)) {
        expect(result.right.variant).toBe('error');
      }
    });

    it('should return error variant for invalid JSON in domain/types/value', async () => {
      const storage = createTestStorage();
      const result = await handler.verifyTypedData(
        {
          address: VALID_ADDRESS,
          domain: 'not-json',
          types: '{}',
          value: '{}',
          signature: '0xsig',
        },
        storage,
      )();
      expect(E.isRight(result)).toBe(true);
      if (E.isRight(result)) {
        expect(result.right.variant).toBe('error');
        if (result.right.variant === 'error') {
          expect(result.right.message).toContain('Invalid typed data');
        }
      }
    });

    it('should return ok or invalid for valid typed data input', async () => {
      const storage = createTestStorage();
      const result = await handler.verifyTypedData(
        {
          address: VALID_ADDRESS,
          domain: '{"name":"test"}',
          types: '{"Person":[]}',
          value: '{"name":"Alice"}',
          signature: '0xdeadbeef',
        },
        storage,
      )();
      expect(E.isRight(result)).toBe(true);
      if (E.isRight(result)) {
        expect(['ok', 'invalid']).toContain(result.right.variant);
      }
    });

    it('should persist typed verification to storage', async () => {
      const storage = createTestStorage();
      await handler.verifyTypedData(
        {
          address: VALID_ADDRESS,
          domain: '{}',
          types: '{}',
          value: '{}',
          signature: '0xsig',
        },
        storage,
      )();
      const records = await storage.find('typed_verification');
      expect(records.length).toBeGreaterThan(0);
    });

    it('should return left on storage failure', async () => {
      const storage = createFailingStorage();
      const result = await handler.verifyTypedData(
        {
          address: VALID_ADDRESS,
          domain: '{}',
          types: '{}',
          value: '{}',
          signature: '0xsig',
        },
        storage,
      )();
      expect(E.isLeft(result)).toBe(true);
    });
  });

  describe('getNonce', () => {
    it('should return notFound when no nonce is stored', async () => {
      const storage = createTestStorage();
      const result = await handler.getNonce(
        { address: VALID_ADDRESS },
        storage,
      )();
      expect(E.isRight(result)).toBe(true);
      if (E.isRight(result)) {
        expect(result.right.variant).toBe('notFound');
      }
    });

    it('should return ok with nonce value after nonce is stored', async () => {
      const storage = createTestStorage();
      await storage.put('nonce', VALID_ADDRESS, {
        address: VALID_ADDRESS,
        nonce: 5,
      });
      const result = await handler.getNonce(
        { address: VALID_ADDRESS },
        storage,
      )();
      expect(E.isRight(result)).toBe(true);
      if (E.isRight(result)) {
        expect(result.right.variant).toBe('ok');
        if (result.right.variant === 'ok') {
          expect(result.right.nonce).toBe(5);
        }
      }
    });

    it('should return left on storage failure', async () => {
      const storage = createFailingStorage();
      const result = await handler.getNonce(
        { address: VALID_ADDRESS },
        storage,
      )();
      expect(E.isLeft(result)).toBe(true);
    });
  });

  describe('incrementNonce', () => {
    it('should increment nonce from 0 when no prior nonce exists', async () => {
      const storage = createTestStorage();
      const result = await handler.incrementNonce(
        { address: VALID_ADDRESS },
        storage,
      )();
      expect(E.isRight(result)).toBe(true);
      if (E.isRight(result)) {
        expect(result.right.variant).toBe('ok');
        expect(result.right.nonce).toBe(1);
      }
    });

    it('should increment existing nonce', async () => {
      const storage = createTestStorage();
      await storage.put('nonce', VALID_ADDRESS, {
        address: VALID_ADDRESS,
        nonce: 3,
      });
      const result = await handler.incrementNonce(
        { address: VALID_ADDRESS },
        storage,
      )();
      expect(E.isRight(result)).toBe(true);
      if (E.isRight(result)) {
        expect(result.right.variant).toBe('ok');
        expect(result.right.nonce).toBe(4);
      }
    });

    it('should persist updated nonce to storage', async () => {
      const storage = createTestStorage();
      await handler.incrementNonce({ address: VALID_ADDRESS }, storage)();
      const record = await storage.get('nonce', VALID_ADDRESS);
      expect(record).not.toBeNull();
      expect(record!['nonce']).toBe(1);
    });

    it('should return left on storage failure', async () => {
      const storage = createFailingStorage();
      const result = await handler.incrementNonce(
        { address: VALID_ADDRESS },
        storage,
      )();
      expect(E.isLeft(result)).toBe(true);
    });
  });
});
