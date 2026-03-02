// CloudFormationProvider — handler.test.ts
// Unit tests for cloudFormationProvider handler actions.

import { describe, it, expect } from 'vitest';
import * as TE from 'fp-ts/TaskEither';
import * as E from 'fp-ts/Either';
import { pipe } from 'fp-ts/function';

import { cloudFormationProviderHandler } from './handler.js';
import type { CloudFormationProviderStorage } from './types.js';

// In-memory test storage
const createTestStorage = (): CloudFormationProviderStorage => {
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
const createFailingStorage = (): CloudFormationProviderStorage => ({
  get: async () => { throw new Error('storage failure'); },
  put: async () => { throw new Error('storage failure'); },
  delete: async () => { throw new Error('storage failure'); },
  find: async () => { throw new Error('storage failure'); },
});

describe('CloudFormationProvider handler', () => {
  describe('generate', () => {
    it('should return ok with stack name and files', async () => {
      const storage = createTestStorage();
      const plan = JSON.stringify({
        stackName: 'my-stack',
        resources: [{ type: 'AWS::S3::Bucket' }],
      });

      const result = await cloudFormationProviderHandler.generate(
        { plan },
        storage,
      )();

      expect(E.isRight(result)).toBe(true);
      if (E.isRight(result)) {
        expect(result.right.variant).toBe('ok');
        expect(result.right.stack).toBe('my-stack');
        expect(result.right.files.length).toBe(2);
      }
    });

    it('should return Left on storage failure', async () => {
      const storage = createFailingStorage();
      const plan = JSON.stringify({ stackName: 'my-stack', resources: [] });

      const result = await cloudFormationProviderHandler.generate(
        { plan },
        storage,
      )();

      expect(E.isLeft(result)).toBe(true);
    });
  });

  describe('preview', () => {
    it('should return ok with change counts when stack has new resources', async () => {
      const storage = createTestStorage();
      await storage.put('cfn_stacks', 'my-stack', {
        stackName: 'my-stack',
        resources: ['AWS::S3::Bucket', 'AWS::Lambda::Function'],
        appliedResources: ['AWS::S3::Bucket'],
      });

      const result = await cloudFormationProviderHandler.preview(
        { stack: 'my-stack' },
        storage,
      )();

      expect(E.isRight(result)).toBe(true);
      if (E.isRight(result)) {
        expect(result.right.variant).toBe('ok');
        if (result.right.variant === 'ok') {
          expect(result.right.toCreate).toBe(1);
          expect(result.right.toUpdate).toBe(1);
        }
      }
    });

    it('should return changeSetEmpty when stack does not exist', async () => {
      const storage = createTestStorage();

      const result = await cloudFormationProviderHandler.preview(
        { stack: 'nonexistent' },
        storage,
      )();

      expect(E.isRight(result)).toBe(true);
      if (E.isRight(result)) {
        expect(result.right.variant).toBe('changeSetEmpty');
      }
    });

    it('should return ok with toUpdate count when resources match applied (treated as updates)', async () => {
      const storage = createTestStorage();
      // When resources and appliedResources overlap, the handler counts overlaps as
      // toUpdate (not zero changes), so it returns 'ok' rather than 'changeSetEmpty'.
      await storage.put('cfn_stacks', 'my-stack', {
        stackName: 'my-stack',
        resources: ['AWS::S3::Bucket'],
        appliedResources: ['AWS::S3::Bucket'],
      });

      const result = await cloudFormationProviderHandler.preview(
        { stack: 'my-stack' },
        storage,
      )();

      expect(E.isRight(result)).toBe(true);
      if (E.isRight(result)) {
        expect(result.right.variant).toBe('ok');
        if (result.right.variant === 'ok') {
          expect(result.right.toCreate).toBe(0);
          expect(result.right.toUpdate).toBe(1);
          expect(result.right.toDelete).toBe(0);
        }
      }
    });

    it('should return Left on storage failure', async () => {
      const storage = createFailingStorage();

      const result = await cloudFormationProviderHandler.preview(
        { stack: 'my-stack' },
        storage,
      )();

      expect(E.isLeft(result)).toBe(true);
    });
  });

  describe('apply', () => {
    it('should return ok when stack exists and no capabilities needed', async () => {
      const storage = createTestStorage();
      await storage.put('cfn_stacks', 'my-stack', {
        stackName: 'my-stack',
        resources: ['AWS::S3::Bucket'],
        appliedResources: [],
        capabilities: [],
      });

      const result = await cloudFormationProviderHandler.apply(
        { stack: 'my-stack' },
        storage,
      )();

      expect(E.isRight(result)).toBe(true);
      if (E.isRight(result)) {
        expect(result.right.variant).toBe('ok');
        if (result.right.variant === 'ok') {
          expect(result.right.created).toContain('AWS::S3::Bucket');
        }
      }
    });

    it('should return rollbackComplete when stack does not exist', async () => {
      const storage = createTestStorage();

      const result = await cloudFormationProviderHandler.apply(
        { stack: 'nonexistent' },
        storage,
      )();

      expect(E.isRight(result)).toBe(true);
      if (E.isRight(result)) {
        expect(result.right.variant).toBe('rollbackComplete');
      }
    });

    it('should return insufficientCapabilities when IAM resources need capabilities', async () => {
      const storage = createTestStorage();
      await storage.put('cfn_stacks', 'my-stack', {
        stackName: 'my-stack',
        resources: ['AWS::IAM::Role'],
        appliedResources: [],
        capabilities: [],
      });

      const result = await cloudFormationProviderHandler.apply(
        { stack: 'my-stack' },
        storage,
      )();

      expect(E.isRight(result)).toBe(true);
      if (E.isRight(result)) {
        expect(result.right.variant).toBe('insufficientCapabilities');
      }
    });

    it('should return Left on storage failure', async () => {
      const storage = createFailingStorage();

      const result = await cloudFormationProviderHandler.apply(
        { stack: 'my-stack' },
        storage,
      )();

      expect(E.isLeft(result)).toBe(true);
    });
  });

  describe('teardown', () => {
    it('should return ok with destroyed resources when stack exists', async () => {
      const storage = createTestStorage();
      await storage.put('cfn_stacks', 'my-stack', {
        stackName: 'my-stack',
        appliedResources: ['AWS::S3::Bucket'],
      });

      const result = await cloudFormationProviderHandler.teardown(
        { stack: 'my-stack' },
        storage,
      )();

      expect(E.isRight(result)).toBe(true);
      if (E.isRight(result)) {
        expect(result.right.variant).toBe('ok');
        if (result.right.variant === 'ok') {
          expect(result.right.destroyed).toContain('AWS::S3::Bucket');
        }
      }
    });

    it('should return deletionFailed when stack does not exist', async () => {
      const storage = createTestStorage();

      const result = await cloudFormationProviderHandler.teardown(
        { stack: 'nonexistent' },
        storage,
      )();

      expect(E.isRight(result)).toBe(true);
      if (E.isRight(result)) {
        expect(result.right.variant).toBe('deletionFailed');
      }
    });

    it('should return Left on storage failure', async () => {
      const storage = createFailingStorage();

      const result = await cloudFormationProviderHandler.teardown(
        { stack: 'my-stack' },
        storage,
      )();

      expect(E.isLeft(result)).toBe(true);
    });
  });
});
