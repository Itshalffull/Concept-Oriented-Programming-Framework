// FluxProvider — handler.test.ts
// Unit tests for fluxProvider handler actions.

import { describe, it, expect } from 'vitest';
import * as TE from 'fp-ts/TaskEither';
import * as E from 'fp-ts/Either';
import { pipe } from 'fp-ts/function';

import { fluxProviderHandler } from './handler.js';
import type { FluxProviderStorage } from './types.js';

const createTestStorage = (): FluxProviderStorage => {
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

const createFailingStorage = (): FluxProviderStorage => ({
  get: async () => { throw new Error('storage failure'); },
  put: async () => { throw new Error('storage failure'); },
  delete: async () => { throw new Error('storage failure'); },
  find: async () => { throw new Error('storage failure'); },
});

describe('FluxProvider handler', () => {
  describe('emit', () => {
    it('should emit a kustomization manifest', async () => {
      const storage = createTestStorage();
      const result = await fluxProviderHandler.emit(
        { plan: JSON.stringify({ name: 'my-kust', namespace: 'flux-system' }), repo: 'my-repo', path: '/deploy' },
        storage,
      )();
      expect(E.isRight(result)).toBe(true);
      if (E.isRight(result)) {
        expect(result.right.variant).toBe('ok');
        expect(result.right.kustomization).toBe('my-kust');
        expect(result.right.files.length).toBeGreaterThanOrEqual(2);
      }
    });

    it('should use defaults when plan has no name', async () => {
      const storage = createTestStorage();
      const result = await fluxProviderHandler.emit(
        { plan: '{}', repo: 'repo', path: '/out' },
        storage,
      )();
      expect(E.isRight(result)).toBe(true);
      if (E.isRight(result)) {
        expect(result.right.variant).toBe('ok');
        expect(result.right.kustomization).toBeDefined();
      }
    });

    it('should return left on storage failure', async () => {
      const storage = createFailingStorage();
      const result = await fluxProviderHandler.emit(
        { plan: '{}', repo: 'repo', path: '/out' },
        storage,
      )();
      expect(E.isLeft(result)).toBe(true);
    });
  });

  describe('reconciliationStatus', () => {
    it('should return ok status for a reconciled kustomization', async () => {
      const storage = createTestStorage();
      await fluxProviderHandler.emit(
        { plan: JSON.stringify({ name: 'kust-1' }), repo: 'repo', path: '/deploy' },
        storage,
      )();
      const result = await fluxProviderHandler.reconciliationStatus(
        { kustomization: 'kust-1' },
        storage,
      )();
      expect(E.isRight(result)).toBe(true);
      if (E.isRight(result)) {
        expect(result.right.variant).toBe('ok');
      }
    });

    it('should return failed for unknown kustomization', async () => {
      const storage = createTestStorage();
      const result = await fluxProviderHandler.reconciliationStatus(
        { kustomization: 'missing' },
        storage,
      )();
      expect(E.isRight(result)).toBe(true);
      if (E.isRight(result)) {
        expect(result.right.variant).toBe('failed');
      }
    });

    it('should return pending when waitingOn is set', async () => {
      const storage = createTestStorage();
      await storage.put('flux_kustomizations', 'kust-pending', {
        kustomization: 'kust-pending',
        readyStatus: 'False',
        waitingOn: ['dep-a', 'dep-b'],
      });
      const result = await fluxProviderHandler.reconciliationStatus(
        { kustomization: 'kust-pending' },
        storage,
      )();
      expect(E.isRight(result)).toBe(true);
      if (E.isRight(result)) {
        expect(result.right.variant).toBe('pending');
      }
    });

    it('should return left on storage failure', async () => {
      const storage = createFailingStorage();
      const result = await fluxProviderHandler.reconciliationStatus(
        { kustomization: 'kust-1' },
        storage,
      )();
      expect(E.isLeft(result)).toBe(true);
    });
  });

  describe('helmRelease', () => {
    it('should install a helm release into a kustomization', async () => {
      const storage = createTestStorage();
      await fluxProviderHandler.emit(
        { plan: JSON.stringify({ name: 'kust-1' }), repo: 'repo', path: '/deploy' },
        storage,
      )();
      const result = await fluxProviderHandler.helmRelease(
        { kustomization: 'kust-1', chart: 'nginx', values: '{}' },
        storage,
      )();
      expect(E.isRight(result)).toBe(true);
      if (E.isRight(result)) {
        expect(result.right.variant).toBe('ok');
        if (result.right.variant === 'ok') {
          expect(result.right.releaseName).toContain('nginx');
        }
      }
    });

    it('should return chartNotFound for missing kustomization', async () => {
      const storage = createTestStorage();
      const result = await fluxProviderHandler.helmRelease(
        { kustomization: 'missing', chart: 'nginx', values: '{}' },
        storage,
      )();
      expect(E.isRight(result)).toBe(true);
      if (E.isRight(result)) {
        expect(result.right.variant).toBe('chartNotFound');
      }
    });

    it('should return chartNotFound for unknown chart prefix', async () => {
      const storage = createTestStorage();
      await fluxProviderHandler.emit(
        { plan: JSON.stringify({ name: 'kust-1' }), repo: 'repo', path: '/deploy' },
        storage,
      )();
      const result = await fluxProviderHandler.helmRelease(
        { kustomization: 'kust-1', chart: 'unknown/bad-chart', values: '{}' },
        storage,
      )();
      expect(E.isRight(result)).toBe(true);
      if (E.isRight(result)) {
        expect(result.right.variant).toBe('chartNotFound');
      }
    });

    it('should return left on storage failure', async () => {
      const storage = createFailingStorage();
      const result = await fluxProviderHandler.helmRelease(
        { kustomization: 'kust-1', chart: 'nginx', values: '{}' },
        storage,
      )();
      expect(E.isLeft(result)).toBe(true);
    });
  });
});
