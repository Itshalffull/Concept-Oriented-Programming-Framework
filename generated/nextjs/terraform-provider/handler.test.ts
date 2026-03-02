// TerraformProvider — handler.test.ts
import { describe, it, expect } from 'vitest';
import * as TE from 'fp-ts/TaskEither';
import * as E from 'fp-ts/Either';
import { pipe } from 'fp-ts/function';

import { terraformProviderHandler } from './handler.js';
import type { TerraformProviderStorage } from './types.js';

const createTestStorage = (): TerraformProviderStorage => {
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

const createFailingStorage = (): TerraformProviderStorage => ({
  get: async () => { throw new Error('storage failure'); },
  put: async () => { throw new Error('storage failure'); },
  delete: async () => { throw new Error('storage failure'); },
  find: async () => { throw new Error('storage failure'); },
});

describe('TerraformProvider handler', () => {
  describe('generate', () => {
    it('should generate HCL files from a valid plan', async () => {
      const storage = createTestStorage();
      const plan = JSON.stringify({
        workspace: 'my-ws',
        resources: [{ type: 'aws_s3_bucket' }],
        providers: ['hashicorp/aws'],
      });

      const result = await terraformProviderHandler.generate(
        { plan },
        storage,
      )();

      expect(E.isRight(result)).toBe(true);
      if (E.isRight(result)) {
        expect(result.right.variant).toBe('ok');
        expect(result.right.workspace).toBe('my-ws');
        expect(result.right.files).toHaveLength(3);
      }
    });

    it('should use a generated workspace name when not provided', async () => {
      const storage = createTestStorage();
      const plan = JSON.stringify({ resources: [] });

      const result = await terraformProviderHandler.generate(
        { plan },
        storage,
      )();

      expect(E.isRight(result)).toBe(true);
      if (E.isRight(result)) {
        expect(result.right.workspace).toMatch(/^ws-/);
      }
    });

    it('should return left on storage failure', async () => {
      const storage = createFailingStorage();

      const result = await terraformProviderHandler.generate(
        { plan: JSON.stringify({ workspace: 'ws' }) },
        storage,
      )();

      expect(E.isLeft(result)).toBe(true);
    });
  });

  describe('preview', () => {
    it('should return backendInitRequired when workspace does not exist', async () => {
      const storage = createTestStorage();

      const result = await terraformProviderHandler.preview(
        { workspace: 'unknown' },
        storage,
      )();

      expect(E.isRight(result)).toBe(true);
      if (E.isRight(result)) {
        expect(result.right.variant).toBe('backendInitRequired');
      }
    });

    it('should return backendInitRequired when backend is not initialized', async () => {
      const storage = createTestStorage();
      await storage.put('tf_workspaces', 'my-ws', {
        workspace: 'my-ws',
        backendInitialized: false,
        resources: ['aws_s3_bucket'],
      });

      const result = await terraformProviderHandler.preview(
        { workspace: 'my-ws' },
        storage,
      )();

      expect(E.isRight(result)).toBe(true);
      if (E.isRight(result)) {
        expect(result.right.variant).toBe('backendInitRequired');
      }
    });

    it('should return stateLocked when workspace has a lock', async () => {
      const storage = createTestStorage();
      await storage.put('tf_workspaces', 'my-ws', {
        workspace: 'my-ws',
        backendInitialized: true,
        lockId: 'lock-123',
        lockedBy: 'user-a',
        resources: [],
      });

      const result = await terraformProviderHandler.preview(
        { workspace: 'my-ws' },
        storage,
      )();

      expect(E.isRight(result)).toBe(true);
      if (E.isRight(result)) {
        expect(result.right.variant).toBe('stateLocked');
      }
    });

    it('should return ok with resource counts when backend is initialized', async () => {
      const storage = createTestStorage();
      await storage.put('tf_workspaces', 'my-ws', {
        workspace: 'my-ws',
        backendInitialized: true,
        resources: ['aws_s3_bucket', 'aws_lambda'],
        appliedResources: ['aws_s3_bucket'],
      });

      const result = await terraformProviderHandler.preview(
        { workspace: 'my-ws' },
        storage,
      )();

      expect(E.isRight(result)).toBe(true);
      if (E.isRight(result)) {
        expect(result.right.variant).toBe('ok');
        if (result.right.variant === 'ok') {
          expect(result.right.toCreate).toBe(1);
          expect(result.right.toUpdate).toBe(1);
          expect(result.right.toDelete).toBe(0);
        }
      }
    });
  });

  describe('apply', () => {
    it('should apply resources and return ok', async () => {
      const storage = createTestStorage();
      await storage.put('tf_workspaces', 'my-ws', {
        workspace: 'my-ws',
        resources: ['aws_s3_bucket'],
        appliedResources: [],
      });

      const result = await terraformProviderHandler.apply(
        { workspace: 'my-ws' },
        storage,
      )();

      expect(E.isRight(result)).toBe(true);
      if (E.isRight(result)) {
        expect(result.right.variant).toBe('ok');
        if (result.right.variant === 'ok') {
          expect(result.right.created).toContain('aws_s3_bucket');
        }
      }
    });

    it('should return stateLocked when workspace has a lock', async () => {
      const storage = createTestStorage();
      await storage.put('tf_workspaces', 'my-ws', {
        workspace: 'my-ws',
        lockId: 'lock-abc',
        resources: [],
      });

      const result = await terraformProviderHandler.apply(
        { workspace: 'my-ws' },
        storage,
      )();

      expect(E.isRight(result)).toBe(true);
      if (E.isRight(result)) {
        expect(result.right.variant).toBe('stateLocked');
      }
    });

    it('should return stateLocked when workspace does not exist', async () => {
      const storage = createTestStorage();

      const result = await terraformProviderHandler.apply(
        { workspace: 'missing' },
        storage,
      )();

      expect(E.isRight(result)).toBe(true);
      if (E.isRight(result)) {
        expect(result.right.variant).toBe('stateLocked');
      }
    });
  });

  describe('teardown', () => {
    it('should tear down a workspace and return destroyed resources', async () => {
      const storage = createTestStorage();
      await storage.put('tf_workspaces', 'my-ws', {
        workspace: 'my-ws',
        appliedResources: ['aws_s3_bucket', 'aws_lambda'],
      });

      const result = await terraformProviderHandler.teardown(
        { workspace: 'my-ws' },
        storage,
      )();

      expect(E.isRight(result)).toBe(true);
      if (E.isRight(result)) {
        expect(result.right.variant).toBe('ok');
        expect(result.right.destroyed).toHaveLength(2);
      }
    });

    it('should return ok with empty destroyed list for unknown workspace', async () => {
      const storage = createTestStorage();

      const result = await terraformProviderHandler.teardown(
        { workspace: 'missing' },
        storage,
      )();

      expect(E.isRight(result)).toBe(true);
      if (E.isRight(result)) {
        expect(result.right.variant).toBe('ok');
        expect(result.right.destroyed).toHaveLength(0);
      }
    });
  });
});
