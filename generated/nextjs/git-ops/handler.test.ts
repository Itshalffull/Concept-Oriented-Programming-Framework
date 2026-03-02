// GitOps — handler.test.ts
// Unit tests for gitOps handler actions.

import { describe, it, expect } from 'vitest';
import * as TE from 'fp-ts/TaskEither';
import * as E from 'fp-ts/Either';
import { pipe } from 'fp-ts/function';

import { gitOpsHandler } from './handler.js';
import type { GitOpsStorage } from './types.js';

const createTestStorage = (): GitOpsStorage => {
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

const createFailingStorage = (): GitOpsStorage => ({
  get: async () => { throw new Error('storage failure'); },
  put: async () => { throw new Error('storage failure'); },
  delete: async () => { throw new Error('storage failure'); },
  find: async () => { throw new Error('storage failure'); },
});

describe('GitOps handler', () => {
  describe('emit', () => {
    it('should emit a Flux manifest', async () => {
      const storage = createTestStorage();
      const result = await gitOpsHandler.emit(
        { plan: 'deploy-plan', controller: 'flux', repo: 'my-repo', path: '/k8s' },
        storage,
      )();
      expect(E.isRight(result)).toBe(true);
      if (E.isRight(result)) {
        expect(result.right.variant).toBe('ok');
        if (result.right.variant === 'ok') {
          expect(result.right.manifest).toContain('gitops:');
          expect(result.right.files.length).toBeGreaterThanOrEqual(2);
        }
      }
    });

    it('should emit an ArgoCD manifest with extra application file', async () => {
      const storage = createTestStorage();
      const result = await gitOpsHandler.emit(
        { plan: 'deploy-plan', controller: 'argocd', repo: 'my-repo', path: '/k8s' },
        storage,
      )();
      expect(E.isRight(result)).toBe(true);
      if (E.isRight(result) && result.right.variant === 'ok') {
        expect(result.right.files.length).toBeGreaterThanOrEqual(3);
        expect(result.right.files.some((f) => f.includes('application.yaml'))).toBe(true);
      }
    });

    it('should return controllerUnsupported for unknown controller', async () => {
      const storage = createTestStorage();
      const result = await gitOpsHandler.emit(
        { plan: 'plan', controller: 'jenkins', repo: 'repo', path: '/path' },
        storage,
      )();
      expect(E.isRight(result)).toBe(true);
      if (E.isRight(result)) {
        expect(result.right.variant).toBe('controllerUnsupported');
      }
    });

    it('should return left on storage failure', async () => {
      const storage = createFailingStorage();
      const result = await gitOpsHandler.emit(
        { plan: 'p', controller: 'flux', repo: 'r', path: '/p' },
        storage,
      )();
      expect(E.isLeft(result)).toBe(true);
    });
  });

  describe('reconciliationStatus', () => {
    it('should return pending status for newly emitted manifest', async () => {
      const storage = createTestStorage();
      const emitResult = await gitOpsHandler.emit(
        { plan: 'plan-1', controller: 'flux', repo: 'repo', path: '/k8s' },
        storage,
      )();
      if (E.isRight(emitResult) && emitResult.right.variant === 'ok') {
        const result = await gitOpsHandler.reconciliationStatus(
          { manifest: emitResult.right.manifest },
          storage,
        )();
        expect(E.isRight(result)).toBe(true);
        if (E.isRight(result)) {
          expect(result.right.variant).toBe('pending');
        }
      }
    });

    it('should return failed for unknown manifest', async () => {
      const storage = createTestStorage();
      const result = await gitOpsHandler.reconciliationStatus(
        { manifest: 'nonexistent' },
        storage,
      )();
      expect(E.isRight(result)).toBe(true);
      if (E.isRight(result)) {
        expect(result.right.variant).toBe('failed');
      }
    });

    it('should return ok for reconciled manifest', async () => {
      const storage = createTestStorage();
      await storage.put('reconciliation', 'manifest-ok', {
        manifestId: 'manifest-ok',
        status: 'reconciled',
        reconciledAt: new Date().toISOString(),
      });
      const result = await gitOpsHandler.reconciliationStatus(
        { manifest: 'manifest-ok' },
        storage,
      )();
      expect(E.isRight(result)).toBe(true);
      if (E.isRight(result)) {
        expect(result.right.variant).toBe('ok');
      }
    });

    it('should return failed for explicitly failed manifest', async () => {
      const storage = createTestStorage();
      await storage.put('reconciliation', 'manifest-fail', {
        manifestId: 'manifest-fail',
        status: 'failed',
        reason: 'resource conflict',
      });
      const result = await gitOpsHandler.reconciliationStatus(
        { manifest: 'manifest-fail' },
        storage,
      )();
      expect(E.isRight(result)).toBe(true);
      if (E.isRight(result)) {
        expect(result.right.variant).toBe('failed');
      }
    });

    it('should return left on storage failure', async () => {
      const storage = createFailingStorage();
      const result = await gitOpsHandler.reconciliationStatus(
        { manifest: 'm' },
        storage,
      )();
      expect(E.isLeft(result)).toBe(true);
    });
  });
});
