// AwsSmProvider — handler.test.ts
// Unit tests for awsSmProvider handler actions.

import { describe, it, expect } from 'vitest';
import * as TE from 'fp-ts/TaskEither';
import * as E from 'fp-ts/Either';
import { pipe } from 'fp-ts/function';

import { awsSmProviderHandler } from './handler.js';
import type { AwsSmProviderStorage } from './types.js';

// In-memory test storage
const createTestStorage = (): AwsSmProviderStorage => {
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
const createFailingStorage = (): AwsSmProviderStorage => ({
  get: async () => { throw new Error('storage failure'); },
  put: async () => { throw new Error('storage failure'); },
  delete: async () => { throw new Error('storage failure'); },
  find: async () => { throw new Error('storage failure'); },
});

describe('AwsSmProvider handler', () => {
  describe('fetch', () => {
    it('should return ok when secret and version exist', async () => {
      const storage = createTestStorage();
      await storage.put('secrets', 'my-secret', {
        region: 'us-east-1',
        kmsKeyId: 'aws/secretsmanager',
        kmsAccessible: true,
      });
      await storage.put('secret_versions', 'my-secret:AWSCURRENT', {
        value: 'super-secret-value',
        versionId: 'v1',
        encrypted: false,
        decryptionOk: true,
      });

      const result = await awsSmProviderHandler.fetch(
        { secretId: 'my-secret', versionStage: 'AWSCURRENT' },
        storage,
      )();

      expect(E.isRight(result)).toBe(true);
      if (E.isRight(result)) {
        expect(result.right.variant).toBe('ok');
        if (result.right.variant === 'ok') {
          expect(result.right.value).toBe('super-secret-value');
          expect(result.right.versionId).toBe('v1');
          expect(result.right.arn).toContain('my-secret');
        }
      }
    });

    it('should return resourceNotFound when secret does not exist', async () => {
      const storage = createTestStorage();

      const result = await awsSmProviderHandler.fetch(
        { secretId: 'nonexistent', versionStage: 'AWSCURRENT' },
        storage,
      )();

      expect(E.isRight(result)).toBe(true);
      if (E.isRight(result)) {
        expect(result.right.variant).toBe('resourceNotFound');
        if (result.right.variant === 'resourceNotFound') {
          expect(result.right.secretId).toBe('nonexistent');
        }
      }
    });

    it('should return kmsKeyInaccessible when KMS key is not accessible', async () => {
      const storage = createTestStorage();
      await storage.put('secrets', 'my-secret', {
        region: 'us-east-1',
        kmsKeyId: 'custom-kms-key',
        kmsAccessible: false,
      });

      const result = await awsSmProviderHandler.fetch(
        { secretId: 'my-secret', versionStage: 'AWSCURRENT' },
        storage,
      )();

      expect(E.isRight(result)).toBe(true);
      if (E.isRight(result)) {
        expect(result.right.variant).toBe('kmsKeyInaccessible');
        if (result.right.variant === 'kmsKeyInaccessible') {
          expect(result.right.secretId).toBe('my-secret');
          expect(result.right.kmsKeyId).toBe('custom-kms-key');
        }
      }
    });

    it('should return decryptionFailed when decryption fails', async () => {
      const storage = createTestStorage();
      await storage.put('secrets', 'my-secret', {
        region: 'us-east-1',
        kmsKeyId: 'aws/secretsmanager',
        kmsAccessible: true,
      });
      await storage.put('secret_versions', 'my-secret:AWSCURRENT', {
        value: 'encrypted-data',
        versionId: 'v1',
        encrypted: true,
        decryptionOk: false,
      });

      const result = await awsSmProviderHandler.fetch(
        { secretId: 'my-secret', versionStage: 'AWSCURRENT' },
        storage,
      )();

      expect(E.isRight(result)).toBe(true);
      if (E.isRight(result)) {
        expect(result.right.variant).toBe('decryptionFailed');
        if (result.right.variant === 'decryptionFailed') {
          expect(result.right.secretId).toBe('my-secret');
        }
      }
    });

    it('should return Left on storage failure', async () => {
      const storage = createFailingStorage();

      const result = await awsSmProviderHandler.fetch(
        { secretId: 'my-secret', versionStage: 'AWSCURRENT' },
        storage,
      )();

      expect(E.isLeft(result)).toBe(true);
      if (E.isLeft(result)) {
        expect(result.left.code).toBe('STORAGE_ERROR');
      }
    });
  });

  describe('rotate', () => {
    it('should return ok when rotation completes successfully', async () => {
      const storage = createTestStorage();

      const result = await awsSmProviderHandler.rotate(
        { secretId: 'my-secret' },
        storage,
      )();

      expect(E.isRight(result)).toBe(true);
      if (E.isRight(result)) {
        expect(result.right.variant).toBe('ok');
        if (result.right.variant === 'ok') {
          expect(result.right.secretId).toBe('my-secret');
          expect(result.right.newVersionId).toBeTruthy();
        }
      }
    });

    it('should return rotationInProgress when rotation is already running', async () => {
      const storage = createTestStorage();
      await storage.put('rotations', 'my-secret', {
        secretId: 'my-secret',
        status: 'in_progress',
      });

      const result = await awsSmProviderHandler.rotate(
        { secretId: 'my-secret' },
        storage,
      )();

      expect(E.isRight(result)).toBe(true);
      if (E.isRight(result)) {
        expect(result.right.variant).toBe('rotationInProgress');
        if (result.right.variant === 'rotationInProgress') {
          expect(result.right.secretId).toBe('my-secret');
        }
      }
    });

    it('should return Left on storage failure', async () => {
      const storage = createFailingStorage();

      const result = await awsSmProviderHandler.rotate(
        { secretId: 'my-secret' },
        storage,
      )();

      expect(E.isLeft(result)).toBe(true);
      if (E.isLeft(result)) {
        expect(result.left.code).toBe('STORAGE_ERROR');
      }
    });
  });
});
