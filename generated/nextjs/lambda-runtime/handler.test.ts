// LambdaRuntime — handler.test.ts
// Unit tests for lambdaRuntime handler actions.

import { describe, it, expect } from 'vitest';
import * as TE from 'fp-ts/TaskEither';
import * as E from 'fp-ts/Either';
import { pipe } from 'fp-ts/function';

import { lambdaRuntimeHandler } from './handler.js';
import type { LambdaRuntimeStorage } from './types.js';

const createTestStorage = (): LambdaRuntimeStorage => {
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

const createFailingStorage = (): LambdaRuntimeStorage => ({
  get: async () => { throw new Error('storage failure'); },
  put: async () => { throw new Error('storage failure'); },
  delete: async () => { throw new Error('storage failure'); },
  find: async () => { throw new Error('storage failure'); },
});

describe('LambdaRuntime handler', () => {
  describe('provision', () => {
    it('should provision a Lambda function with IAM role present', async () => {
      const storage = createTestStorage();
      await storage.put('iam_roles', 'lambda-exec-user-api', {
        role: 'lambda-exec-user-api',
      });

      const input = {
        concept: 'user-api',
        memory: 256,
        timeout: 30,
        region: 'us-east-1',
      };

      const result = await lambdaRuntimeHandler.provision(input, storage)();
      expect(E.isRight(result)).toBe(true);
      if (E.isRight(result)) {
        expect(result.right.variant).toBe('ok');
        if (result.right.variant === 'ok') {
          expect(result.right.function).toBe('clef-user-api');
          expect(result.right.functionArn).toContain('us-east-1');
          expect(result.right.endpoint).toContain('lambda-url');
        }
      }
    });

    it('should return iamError when no execution role exists', async () => {
      const storage = createTestStorage();
      const input = {
        concept: 'no-role',
        memory: 128,
        timeout: 10,
        region: 'us-west-2',
      };

      const result = await lambdaRuntimeHandler.provision(input, storage)();
      expect(E.isRight(result)).toBe(true);
      if (E.isRight(result)) {
        expect(result.right.variant).toBe('iamError');
        if (result.right.variant === 'iamError') {
          expect(result.right.policy).toContain('lambda-exec-no-role');
        }
      }
    });

    it('should return quotaExceeded when region at capacity', async () => {
      const storage = createTestStorage();
      await storage.put('iam_roles', 'lambda-exec-overflow', {
        role: 'lambda-exec-overflow',
      });
      // Fill up the region with 1000 functions
      for (let i = 0; i < 1000; i++) {
        await storage.put('functions', `fn-${i}`, { region: 'us-east-1' });
      }

      const input = {
        concept: 'overflow',
        memory: 128,
        timeout: 10,
        region: 'us-east-1',
      };

      const result = await lambdaRuntimeHandler.provision(input, storage)();
      expect(E.isRight(result)).toBe(true);
      if (E.isRight(result)) {
        expect(result.right.variant).toBe('quotaExceeded');
      }
    });

    it('should return left on storage failure', async () => {
      const storage = createFailingStorage();
      const input = { concept: 'x', memory: 128, timeout: 10, region: 'us-east-1' };
      const result = await lambdaRuntimeHandler.provision(input, storage)();
      expect(E.isLeft(result)).toBe(true);
    });
  });

  describe('deploy', () => {
    it('should deploy a new version to an existing function', async () => {
      const storage = createTestStorage();
      await storage.put('iam_roles', 'lambda-exec-deploy-svc', {
        role: 'lambda-exec-deploy-svc',
      });
      await lambdaRuntimeHandler.provision({
        concept: 'deploy-svc', memory: 256, timeout: 30, region: 'us-east-1',
      }, storage)();

      const result = await lambdaRuntimeHandler.deploy({
        function: 'clef-deploy-svc',
        artifactLocation: 's3://bucket/deploy-svc.zip',
      }, storage)();
      expect(E.isRight(result)).toBe(true);
      if (E.isRight(result)) {
        expect(result.right.variant).toBe('ok');
        if (result.right.variant === 'ok') {
          expect(result.right.version).toBe('v1');
        }
      }
    });

    it('should increment version on successive deploys', async () => {
      const storage = createTestStorage();
      await storage.put('iam_roles', 'lambda-exec-multi', {
        role: 'lambda-exec-multi',
      });
      await lambdaRuntimeHandler.provision({
        concept: 'multi', memory: 128, timeout: 10, region: 'us-east-1',
      }, storage)();

      await lambdaRuntimeHandler.deploy({
        function: 'clef-multi', artifactLocation: 's3://v1.zip',
      }, storage)();
      const result = await lambdaRuntimeHandler.deploy({
        function: 'clef-multi', artifactLocation: 's3://v2.zip',
      }, storage)();
      expect(E.isRight(result)).toBe(true);
      if (E.isRight(result)) {
        expect(result.right.variant).toBe('ok');
        if (result.right.variant === 'ok') {
          expect(result.right.version).toBe('v2');
        }
      }
    });

    it('should return left for missing function', async () => {
      const storage = createTestStorage();
      const result = await lambdaRuntimeHandler.deploy({
        function: 'nonexistent', artifactLocation: 's3://x.zip',
      }, storage)();
      expect(E.isLeft(result)).toBe(true);
    });

    it('should return left on storage failure', async () => {
      const storage = createFailingStorage();
      const result = await lambdaRuntimeHandler.deploy({
        function: 'x', artifactLocation: 's3://x.zip',
      }, storage)();
      expect(E.isLeft(result)).toBe(true);
    });
  });

  describe('setTrafficWeight', () => {
    it('should set the alias weight on an existing function', async () => {
      const storage = createTestStorage();
      await storage.put('iam_roles', 'lambda-exec-weight', { role: 'r' });
      await lambdaRuntimeHandler.provision({
        concept: 'weight', memory: 128, timeout: 10, region: 'us-east-1',
      }, storage)();

      const result = await lambdaRuntimeHandler.setTrafficWeight({
        function: 'clef-weight', aliasWeight: 50,
      }, storage)();
      expect(E.isRight(result)).toBe(true);
      if (E.isRight(result)) {
        expect(result.right.variant).toBe('ok');
      }
    });

    it('should clamp weight to 0-100 range', async () => {
      const storage = createTestStorage();
      await storage.put('iam_roles', 'lambda-exec-clamp', { role: 'r' });
      await lambdaRuntimeHandler.provision({
        concept: 'clamp', memory: 128, timeout: 10, region: 'us-east-1',
      }, storage)();

      const result = await lambdaRuntimeHandler.setTrafficWeight({
        function: 'clef-clamp', aliasWeight: 150,
      }, storage)();
      expect(E.isRight(result)).toBe(true);
      if (E.isRight(result)) {
        expect(result.right.variant).toBe('ok');
      }
    });

    it('should return left for missing function', async () => {
      const storage = createTestStorage();
      const result = await lambdaRuntimeHandler.setTrafficWeight({
        function: 'nope', aliasWeight: 50,
      }, storage)();
      expect(E.isLeft(result)).toBe(true);
    });
  });

  describe('rollback', () => {
    it('should rollback to a previous version', async () => {
      const storage = createTestStorage();
      await storage.put('iam_roles', 'lambda-exec-rollback', { role: 'r' });
      await lambdaRuntimeHandler.provision({
        concept: 'rollback', memory: 128, timeout: 10, region: 'us-east-1',
      }, storage)();
      await lambdaRuntimeHandler.deploy({
        function: 'clef-rollback', artifactLocation: 's3://v1.zip',
      }, storage)();
      await lambdaRuntimeHandler.deploy({
        function: 'clef-rollback', artifactLocation: 's3://v2.zip',
      }, storage)();

      const result = await lambdaRuntimeHandler.rollback({
        function: 'clef-rollback', targetVersion: 'v1',
      }, storage)();
      expect(E.isRight(result)).toBe(true);
      if (E.isRight(result)) {
        expect(result.right.variant).toBe('ok');
        expect(result.right.restoredVersion).toBe('v1');
      }
    });

    it('should return left for missing version', async () => {
      const storage = createTestStorage();
      await storage.put('iam_roles', 'lambda-exec-rb2', { role: 'r' });
      await lambdaRuntimeHandler.provision({
        concept: 'rb2', memory: 128, timeout: 10, region: 'us-east-1',
      }, storage)();

      const result = await lambdaRuntimeHandler.rollback({
        function: 'clef-rb2', targetVersion: 'v999',
      }, storage)();
      expect(E.isLeft(result)).toBe(true);
    });

    it('should return left for missing function', async () => {
      const storage = createTestStorage();
      const result = await lambdaRuntimeHandler.rollback({
        function: 'absent', targetVersion: 'v1',
      }, storage)();
      expect(E.isLeft(result)).toBe(true);
    });
  });

  describe('destroy', () => {
    it('should destroy a function with no dependents', async () => {
      const storage = createTestStorage();
      await storage.put('iam_roles', 'lambda-exec-del', { role: 'r' });
      await lambdaRuntimeHandler.provision({
        concept: 'del', memory: 128, timeout: 10, region: 'us-east-1',
      }, storage)();

      const result = await lambdaRuntimeHandler.destroy({
        function: 'clef-del',
      }, storage)();
      expect(E.isRight(result)).toBe(true);
      if (E.isRight(result)) {
        expect(result.right.variant).toBe('ok');
      }
    });

    it('should return resourceInUse when event sources exist', async () => {
      const storage = createTestStorage();
      await storage.put('event_sources', 'trigger-1', {
        functionName: 'clef-busy',
        name: 'sqs-trigger',
      });

      const result = await lambdaRuntimeHandler.destroy({
        function: 'clef-busy',
      }, storage)();
      expect(E.isRight(result)).toBe(true);
      if (E.isRight(result)) {
        expect(result.right.variant).toBe('resourceInUse');
        if (result.right.variant === 'resourceInUse') {
          expect(result.right.dependents).toContain('sqs-trigger');
        }
      }
    });

    it('should return left on storage failure', async () => {
      const storage = createFailingStorage();
      const result = await lambdaRuntimeHandler.destroy({ function: 'x' }, storage)();
      expect(E.isLeft(result)).toBe(true);
    });
  });
});
