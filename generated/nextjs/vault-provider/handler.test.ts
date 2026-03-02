// VaultProvider — handler.test.ts
import { describe, it, expect } from 'vitest';
import * as TE from 'fp-ts/TaskEither';
import * as E from 'fp-ts/Either';
import { pipe } from 'fp-ts/function';

import { vaultProviderHandler } from './handler.js';
import type { VaultProviderStorage } from './types.js';

const createTestStorage = (): VaultProviderStorage => {
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

const createFailingStorage = (): VaultProviderStorage => ({
  get: async () => { throw new Error('storage failure'); },
  put: async () => { throw new Error('storage failure'); },
  delete: async () => { throw new Error('storage failure'); },
  find: async () => { throw new Error('storage failure'); },
});

const handler = vaultProviderHandler;

/** Seed a secret in storage for testing fetch operations. */
const seedSecret = async (
  storage: VaultProviderStorage,
  path: string,
  value: string,
  leaseDuration = 3600,
) => {
  await storage.put('vault_secrets', path, {
    path,
    value,
    version: 1,
    leaseDuration,
  });
};

describe('VaultProvider handler', () => {
  describe('fetch', () => {
    it('should fetch a secret and issue a lease', async () => {
      const storage = createTestStorage();
      await seedSecret(storage, 'secret/db-password', 's3cr3t');

      const result = await handler.fetch({ path: 'secret/db-password' }, storage)();
      expect(E.isRight(result)).toBe(true);
      if (E.isRight(result)) {
        expect(result.right.variant).toBe('ok');
        if (result.right.variant === 'ok') {
          expect(result.right.value).toBe('s3cr3t');
          expect(result.right.leaseId).toBeDefined();
          expect(result.right.leaseDuration).toBe(3600);
        }
      }
    });

    it('should return pathNotFound when secret does not exist', async () => {
      const storage = createTestStorage();
      const result = await handler.fetch({ path: 'secret/missing' }, storage)();
      expect(E.isRight(result)).toBe(true);
      if (E.isRight(result)) {
        expect(result.right.variant).toBe('pathNotFound');
        if (result.right.variant === 'pathNotFound') {
          expect(result.right.path).toBe('secret/missing');
        }
      }
    });

    it('should return sealed when vault is sealed', async () => {
      const storage = createTestStorage();
      await storage.put('vault_config', 'status', {
        state: 'sealed',
        address: 'https://vault.example.com:8200',
      });
      const result = await handler.fetch({ path: 'secret/any' }, storage)();
      expect(E.isRight(result)).toBe(true);
      if (E.isRight(result)) {
        expect(result.right.variant).toBe('sealed');
        if (result.right.variant === 'sealed') {
          expect(result.right.address).toBe('https://vault.example.com:8200');
        }
      }
    });

    it('should return tokenExpired when vault token is expired', async () => {
      const storage = createTestStorage();
      await storage.put('vault_config', 'status', {
        state: 'token_expired',
        address: 'https://vault.example.com:8200',
      });
      const result = await handler.fetch({ path: 'secret/any' }, storage)();
      expect(E.isRight(result)).toBe(true);
      if (E.isRight(result)) {
        expect(result.right.variant).toBe('tokenExpired');
      }
    });

    it('should persist a lease record on successful fetch', async () => {
      const storage = createTestStorage();
      await seedSecret(storage, 'secret/api-key', 'key-123');
      const result = await handler.fetch({ path: 'secret/api-key' }, storage)();
      expect(E.isRight(result)).toBe(true);
      if (E.isRight(result) && result.right.variant === 'ok') {
        const leaseId = result.right.leaseId;
        const leaseRecord = await storage.get('vault_leases', leaseId);
        expect(leaseRecord).not.toBeNull();
        expect(leaseRecord!.path).toBe('secret/api-key');
      }
    });

    it('should return left on storage failure', async () => {
      const storage = createFailingStorage();
      const result = await handler.fetch({ path: 'secret/fail' }, storage)();
      expect(E.isLeft(result)).toBe(true);
    });
  });

  describe('renewLease', () => {
    it('should renew a valid lease', async () => {
      const storage = createTestStorage();
      await seedSecret(storage, 'secret/renew-test', 'value');
      const fetchResult = await handler.fetch({ path: 'secret/renew-test' }, storage)();
      expect(E.isRight(fetchResult)).toBe(true);
      if (E.isRight(fetchResult) && fetchResult.right.variant === 'ok') {
        const leaseId = fetchResult.right.leaseId;
        const result = await handler.renewLease({ leaseId }, storage)();
        expect(E.isRight(result)).toBe(true);
        if (E.isRight(result)) {
          expect(result.right.variant).toBe('ok');
          if (result.right.variant === 'ok') {
            expect(result.right.leaseId).toBe(leaseId);
            expect(result.right.newDuration).toBeGreaterThan(0);
          }
        }
      }
    });

    it('should return leaseExpired when lease does not exist', async () => {
      const storage = createTestStorage();
      const result = await handler.renewLease(
        { leaseId: 'nonexistent-lease' },
        storage,
      )();
      expect(E.isRight(result)).toBe(true);
      if (E.isRight(result)) {
        expect(result.right.variant).toBe('leaseExpired');
      }
    });

    it('should return left on storage failure', async () => {
      const storage = createFailingStorage();
      const result = await handler.renewLease(
        { leaseId: 'fail-lease' },
        storage,
      )();
      expect(E.isLeft(result)).toBe(true);
    });
  });

  describe('rotate', () => {
    it('should create a new secret version when path has no prior secret', async () => {
      const storage = createTestStorage();
      const result = await handler.rotate({ path: 'secret/new-path' }, storage)();
      expect(E.isRight(result)).toBe(true);
      if (E.isRight(result)) {
        expect(result.right.variant).toBe('ok');
        expect(result.right.newVersion).toBe(1);
      }
    });

    it('should increment version when rotating an existing secret', async () => {
      const storage = createTestStorage();
      await seedSecret(storage, 'secret/rotate-me', 'old-value');
      const result = await handler.rotate({ path: 'secret/rotate-me' }, storage)();
      expect(E.isRight(result)).toBe(true);
      if (E.isRight(result)) {
        expect(result.right.variant).toBe('ok');
        expect(result.right.newVersion).toBe(2);
      }
    });

    it('should update the secret value on rotation', async () => {
      const storage = createTestStorage();
      await seedSecret(storage, 'secret/rotate-val', 'original');
      await handler.rotate({ path: 'secret/rotate-val' }, storage)();
      const updated = await storage.get('vault_secrets', 'secret/rotate-val');
      expect(updated).not.toBeNull();
      expect(updated!.value).not.toBe('original');
      expect((updated!.value as string)).toContain('rotated-');
    });

    it('should return left on storage failure', async () => {
      const storage = createFailingStorage();
      const result = await handler.rotate({ path: 'secret/fail' }, storage)();
      expect(E.isLeft(result)).toBe(true);
    });
  });
});
