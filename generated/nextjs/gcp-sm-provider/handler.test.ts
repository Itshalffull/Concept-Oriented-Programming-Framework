// GcpSmProvider — handler.test.ts
// Unit tests for gcpSmProvider handler actions.

import { describe, it, expect } from 'vitest';
import * as TE from 'fp-ts/TaskEither';
import * as E from 'fp-ts/Either';
import { pipe } from 'fp-ts/function';

import { gcpSmProviderHandler } from './handler.js';
import type { GcpSmProviderStorage } from './types.js';

const createTestStorage = (): GcpSmProviderStorage => {
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

const createFailingStorage = (): GcpSmProviderStorage => ({
  get: async () => { throw new Error('storage failure'); },
  put: async () => { throw new Error('storage failure'); },
  delete: async () => { throw new Error('storage failure'); },
  find: async () => { throw new Error('storage failure'); },
});

const seedSecret = async (storage: GcpSmProviderStorage, secretId: string) => {
  await storage.put('secrets', secretId, {
    projectId: 'my-project',
    iamBindings: ['roles/secretmanager.secretAccessor'],
  });
  await storage.put('secret_versions', `${secretId}:latest`, {
    secretId,
    versionId: 'v1',
    state: 'ENABLED',
    value: 'my-secret-value',
  });
};

describe('GcpSmProvider handler', () => {
  describe('fetch', () => {
    it('should fetch a secret value by id and version', async () => {
      const storage = createTestStorage();
      await seedSecret(storage, 'db-password');
      const result = await gcpSmProviderHandler.fetch(
        { secretId: 'db-password', version: 'latest' },
        storage,
      )();
      expect(E.isRight(result)).toBe(true);
      if (E.isRight(result)) {
        const output = await result.right;
        expect(output.variant).toBe('ok');
        if (output.variant === 'ok') {
          expect(output.value).toBe('my-secret-value');
          expect(output.projectId).toBe('my-project');
        }
      }
    });

    it('should return secretNotFound for missing secret', async () => {
      const storage = createTestStorage();
      const result = await gcpSmProviderHandler.fetch(
        { secretId: 'missing', version: 'latest' },
        storage,
      )();
      expect(E.isRight(result)).toBe(true);
      if (E.isRight(result)) {
        const output = await result.right;
        expect(output.variant).toBe('secretNotFound');
      }
    });

    it('should return iamBindingMissing when no IAM bindings', async () => {
      const storage = createTestStorage();
      await storage.put('secrets', 'no-iam', {
        projectId: 'proj',
        iamBindings: [],
        requestingPrincipal: 'user@example.com',
      });
      const result = await gcpSmProviderHandler.fetch(
        { secretId: 'no-iam', version: 'latest' },
        storage,
      )();
      expect(E.isRight(result)).toBe(true);
      if (E.isRight(result)) {
        const output = await result.right;
        expect(output.variant).toBe('iamBindingMissing');
      }
    });

    it('should return versionDisabled for disabled version', async () => {
      const storage = createTestStorage();
      await storage.put('secrets', 'sec-1', {
        projectId: 'proj',
        iamBindings: ['roles/secretmanager.secretAccessor'],
      });
      await storage.put('secret_versions', 'sec-1:v2', {
        secretId: 'sec-1',
        versionId: 'v2',
        state: 'DISABLED',
        value: 'old-value',
      });
      const result = await gcpSmProviderHandler.fetch(
        { secretId: 'sec-1', version: 'v2' },
        storage,
      )();
      expect(E.isRight(result)).toBe(true);
      if (E.isRight(result)) {
        const output = await result.right;
        expect(output.variant).toBe('versionDisabled');
      }
    });

    it('should return left on storage failure', async () => {
      const storage = createFailingStorage();
      const result = await gcpSmProviderHandler.fetch(
        { secretId: 's', version: 'latest' },
        storage,
      )();
      expect(E.isLeft(result)).toBe(true);
    });
  });

  describe('rotate', () => {
    it('should create a new version and return its id', async () => {
      const storage = createTestStorage();
      await seedSecret(storage, 'api-key');
      const result = await gcpSmProviderHandler.rotate(
        { secretId: 'api-key' },
        storage,
      )();
      expect(E.isRight(result)).toBe(true);
      if (E.isRight(result)) {
        expect(result.right.variant).toBe('ok');
        expect(result.right.secretId).toBe('api-key');
        expect(result.right.newVersionId).toContain('v-');
      }
    });

    it('should work when no previous latest version exists', async () => {
      const storage = createTestStorage();
      const result = await gcpSmProviderHandler.rotate(
        { secretId: 'new-secret' },
        storage,
      )();
      expect(E.isRight(result)).toBe(true);
      if (E.isRight(result)) {
        expect(result.right.variant).toBe('ok');
      }
    });

    it('should return left on storage failure', async () => {
      const storage = createFailingStorage();
      const result = await gcpSmProviderHandler.rotate(
        { secretId: 's' },
        storage,
      )();
      expect(E.isLeft(result)).toBe(true);
    });
  });
});
