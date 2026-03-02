// Secret — handler.test.ts
import { describe, it, expect } from 'vitest';
import * as TE from 'fp-ts/TaskEither';
import * as E from 'fp-ts/Either';
import { pipe } from 'fp-ts/function';

import { secretHandler } from './handler.js';
import type { SecretStorage } from './types.js';

const createTestStorage = (): SecretStorage => {
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

const createFailingStorage = (): SecretStorage => ({
  get: async () => { throw new Error('storage failure'); },
  put: async () => { throw new Error('storage failure'); },
  delete: async () => { throw new Error('storage failure'); },
  find: async () => { throw new Error('storage failure'); },
});

const handler = secretHandler;

describe('Secret handler', () => {
  describe('resolve', () => {
    it('should resolve a valid secret', async () => {
      const storage = createTestStorage();
      await storage.put('secrets', 'vault::db-password', {
        value: 's3cret',
        version: '1',
        restricted: false,
      });
      const result = await handler.resolve({ name: 'db-password', provider: 'vault' }, storage)();
      expect(E.isRight(result)).toBe(true);
      if (E.isRight(result)) {
        expect(result.right.variant).toBe('ok');
        if (result.right.variant === 'ok') {
          expect(result.right.secret).toBe('s3cret');
          expect(result.right.version).toBe('1');
        }
      }
    });

    it('should return notFound for non-existent secret', async () => {
      const storage = createTestStorage();
      const result = await handler.resolve({ name: 'missing', provider: 'vault' }, storage)();
      expect(E.isRight(result)).toBe(true);
      if (E.isRight(result)) {
        expect(result.right.variant).toBe('notFound');
        if (result.right.variant === 'notFound') {
          expect(result.right.name).toBe('missing');
          expect(result.right.provider).toBe('vault');
        }
      }
    });

    it('should return accessDenied for restricted secrets', async () => {
      const storage = createTestStorage();
      await storage.put('secrets', 'aws-sm::admin-key', {
        value: 'top-secret',
        version: '1',
        restricted: true,
        restrictionReason: 'Requires elevated privileges',
      });
      const result = await handler.resolve({ name: 'admin-key', provider: 'aws-sm' }, storage)();
      expect(E.isRight(result)).toBe(true);
      if (E.isRight(result)) {
        expect(result.right.variant).toBe('accessDenied');
        if (result.right.variant === 'accessDenied') {
          expect(result.right.reason).toContain('elevated');
        }
      }
    });

    it('should return expired for secrets past their expiry date', async () => {
      const storage = createTestStorage();
      const pastDate = new Date(Date.now() - 86400000).toISOString();
      await storage.put('secrets', 'vault::temp-token', {
        value: 'expired-token',
        version: '1',
        restricted: false,
        expiresAt: pastDate,
      });
      const result = await handler.resolve({ name: 'temp-token', provider: 'vault' }, storage)();
      expect(E.isRight(result)).toBe(true);
      if (E.isRight(result)) {
        expect(result.right.variant).toBe('expired');
      }
    });

    it('should resolve a non-expired secret with future expiry', async () => {
      const storage = createTestStorage();
      const futureDate = new Date(Date.now() + 86400000).toISOString();
      await storage.put('secrets', 'vault::valid-token', {
        value: 'valid-secret',
        version: '2',
        restricted: false,
        expiresAt: futureDate,
      });
      const result = await handler.resolve({ name: 'valid-token', provider: 'vault' }, storage)();
      expect(E.isRight(result)).toBe(true);
      if (E.isRight(result)) {
        expect(result.right.variant).toBe('ok');
        if (result.right.variant === 'ok') {
          expect(result.right.secret).toBe('valid-secret');
        }
      }
    });

    it('should return left on storage failure', async () => {
      const storage = createFailingStorage();
      const result = await handler.resolve({ name: 'x', provider: 'vault' }, storage)();
      expect(E.isLeft(result)).toBe(true);
    });
  });

  describe('exists', () => {
    it('should return true when secret exists', async () => {
      const storage = createTestStorage();
      await storage.put('secrets', 'vault::db-password', { value: 'x', version: '1' });
      const result = await handler.exists({ name: 'db-password', provider: 'vault' }, storage)();
      expect(E.isRight(result)).toBe(true);
      if (E.isRight(result)) {
        expect(result.right.variant).toBe('ok');
        expect(result.right.exists).toBe(true);
      }
    });

    it('should return false when secret does not exist', async () => {
      const storage = createTestStorage();
      const result = await handler.exists({ name: 'missing', provider: 'vault' }, storage)();
      expect(E.isRight(result)).toBe(true);
      if (E.isRight(result)) {
        expect(result.right.variant).toBe('ok');
        expect(result.right.exists).toBe(false);
      }
    });

    it('should return left on storage failure', async () => {
      const storage = createFailingStorage();
      const result = await handler.exists({ name: 'x', provider: 'vault' }, storage)();
      expect(E.isLeft(result)).toBe(true);
    });
  });

  describe('rotate', () => {
    it('should rotate secret and increment version', async () => {
      const storage = createTestStorage();
      await storage.put('secrets', 'vault::api-key', {
        value: 'old-key',
        version: '3',
        restricted: false,
      });
      const result = await handler.rotate({ name: 'api-key', provider: 'vault' }, storage)();
      expect(E.isRight(result)).toBe(true);
      if (E.isRight(result)) {
        expect(result.right.variant).toBe('ok');
        if (result.right.variant === 'ok') {
          expect(result.right.newVersion).toBe('4');
        }
      }
    });

    it('should return rotationUnsupported for non-rotatable providers', async () => {
      const storage = createTestStorage();
      const result = await handler.rotate({ name: 'key', provider: 'env' }, storage)();
      expect(E.isRight(result)).toBe(true);
      if (E.isRight(result)) {
        expect(result.right.variant).toBe('rotationUnsupported');
      }
    });

    it('should return rotationUnsupported when secret not found in rotatable provider', async () => {
      const storage = createTestStorage();
      const result = await handler.rotate({ name: 'missing', provider: 'aws-sm' }, storage)();
      expect(E.isRight(result)).toBe(true);
      if (E.isRight(result)) {
        expect(result.right.variant).toBe('rotationUnsupported');
      }
    });

    it('should invalidate cache on rotation', async () => {
      const storage = createTestStorage();
      await storage.put('secrets', 'gcp-sm::token', { value: 'old', version: '1', restricted: false });
      await storage.put('secret_cache', 'token', { name: 'token', cachedAt: new Date().toISOString() });
      await handler.rotate({ name: 'token', provider: 'gcp-sm' }, storage)();
      const cached = await storage.get('secret_cache', 'token');
      expect(cached).toBeNull();
    });
  });

  describe('invalidateCache', () => {
    it('should remove cached secret entry', async () => {
      const storage = createTestStorage();
      await storage.put('secret_cache', 'db-password', { name: 'db-password', cachedAt: new Date().toISOString() });
      const result = await handler.invalidateCache({ name: 'db-password' }, storage)();
      expect(E.isRight(result)).toBe(true);
      if (E.isRight(result)) {
        expect(result.right.variant).toBe('ok');
        expect(result.right.secret).toBe('db-password');
      }
      const cached = await storage.get('secret_cache', 'db-password');
      expect(cached).toBeNull();
    });

    it('should succeed even when no cache entry exists', async () => {
      const storage = createTestStorage();
      const result = await handler.invalidateCache({ name: 'nonexistent' }, storage)();
      expect(E.isRight(result)).toBe(true);
      if (E.isRight(result)) {
        expect(result.right.variant).toBe('ok');
      }
    });

    it('should return left on storage failure', async () => {
      const storage = createFailingStorage();
      const result = await handler.invalidateCache({ name: 'x' }, storage)();
      expect(E.isLeft(result)).toBe(true);
    });
  });
});
