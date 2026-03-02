// ArgoCDProvider — handler.test.ts
// Unit tests for argoCDProvider handler actions.

import { describe, it, expect } from 'vitest';
import * as TE from 'fp-ts/TaskEither';
import * as E from 'fp-ts/Either';
import { pipe } from 'fp-ts/function';

import { argoCDProviderHandler } from './handler.js';
import type { ArgoCDProviderStorage } from './types.js';

const createTestStorage = (): ArgoCDProviderStorage => {
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

const createFailingStorage = (): ArgoCDProviderStorage => ({
  get: async () => { throw new Error('storage failure'); },
  put: async () => { throw new Error('storage failure'); },
  delete: async () => { throw new Error('storage failure'); },
  find: async () => { throw new Error('storage failure'); },
});

describe('ArgoCDProvider handler', () => {
  describe('emit', () => {
    it('emits application successfully with valid input', async () => {
      const storage = createTestStorage();
      const result = await argoCDProviderHandler.emit(
        {
          plan: JSON.stringify({ name: 'my-app', namespace: 'argocd', syncPolicy: 'automated' }),
          repo: 'https://github.com/test/repo',
          path: 'k8s/overlays/prod',
        },
        storage,
      )();
      expect(E.isRight(result)).toBe(true);
      if (E.isRight(result)) {
        expect(result.right.variant).toBe('ok');
        expect(result.right.application).toBe('my-app');
        expect(result.right.files.length).toBe(2);
      }
    });

    it('uses defaults for missing plan fields', async () => {
      const storage = createTestStorage();
      const result = await argoCDProviderHandler.emit(
        {
          plan: JSON.stringify({}),
          repo: 'https://github.com/test/repo',
          path: 'k8s',
        },
        storage,
      )();
      expect(E.isRight(result)).toBe(true);
      if (E.isRight(result)) {
        expect(result.right.variant).toBe('ok');
        expect(result.right.files.length).toBe(2);
      }
    });

    it('propagates storage errors', async () => {
      const storage = createFailingStorage();
      const result = await argoCDProviderHandler.emit(
        {
          plan: JSON.stringify({ name: 'my-app' }),
          repo: 'https://github.com/test/repo',
          path: 'k8s',
        },
        storage,
      )();
      expect(E.isLeft(result)).toBe(true);
    });
  });

  describe('reconciliationStatus', () => {
    it('returns failed for missing application', async () => {
      const storage = createTestStorage();
      const result = await argoCDProviderHandler.reconciliationStatus(
        { application: 'nonexistent' },
        storage,
      )();
      expect(E.isRight(result)).toBe(true);
      if (E.isRight(result)) {
        expect(result.right.variant).toBe('failed');
      }
    });

    it('returns ok status after emit', async () => {
      const storage = createTestStorage();
      await argoCDProviderHandler.emit(
        {
          plan: JSON.stringify({ name: 'my-app' }),
          repo: 'https://github.com/test/repo',
          path: 'k8s',
        },
        storage,
      )();
      // Update the app to be synced and healthy
      await storage.put('argocd_apps', 'my-app', {
        application: 'my-app',
        syncStatus: 'Synced',
        healthStatus: 'Healthy',
        waves: [],
      });
      const result = await argoCDProviderHandler.reconciliationStatus(
        { application: 'my-app' },
        storage,
      )();
      expect(E.isRight(result)).toBe(true);
      if (E.isRight(result)) {
        expect(result.right.variant).toBe('ok');
        if (result.right.variant === 'ok') {
          expect(result.right.syncStatus).toBe('Synced');
          expect(result.right.healthStatus).toBe('Healthy');
        }
      }
    });

    it('returns pending when waiting on resources', async () => {
      const storage = createTestStorage();
      await storage.put('argocd_apps', 'pending-app', {
        application: 'pending-app',
        syncStatus: 'OutOfSync',
        healthStatus: 'Progressing',
        waitingOn: ['deployment/api'],
        waves: [],
      });
      const result = await argoCDProviderHandler.reconciliationStatus(
        { application: 'pending-app' },
        storage,
      )();
      expect(E.isRight(result)).toBe(true);
      if (E.isRight(result)) {
        expect(result.right.variant).toBe('pending');
      }
    });

    it('propagates storage errors', async () => {
      const storage = createFailingStorage();
      const result = await argoCDProviderHandler.reconciliationStatus(
        { application: 'my-app' },
        storage,
      )();
      expect(E.isLeft(result)).toBe(true);
    });
  });

  describe('syncWave', () => {
    it('adds sync wave to existing application', async () => {
      const storage = createTestStorage();
      await argoCDProviderHandler.emit(
        {
          plan: JSON.stringify({ name: 'my-app' }),
          repo: 'https://github.com/test/repo',
          path: 'k8s',
        },
        storage,
      )();
      const result = await argoCDProviderHandler.syncWave(
        { application: 'my-app', wave: 1 },
        storage,
      )();
      expect(E.isRight(result)).toBe(true);
      if (E.isRight(result)) {
        expect(result.right.variant).toBe('ok');
        expect(result.right.application).toBe('my-app');
      }
    });

    it('returns error for missing application', async () => {
      const storage = createTestStorage();
      const result = await argoCDProviderHandler.syncWave(
        { application: 'nonexistent', wave: 1 },
        storage,
      )();
      expect(E.isLeft(result)).toBe(true);
    });

    it('propagates storage errors', async () => {
      const storage = createFailingStorage();
      const result = await argoCDProviderHandler.syncWave(
        { application: 'my-app', wave: 1 },
        storage,
      )();
      expect(E.isLeft(result)).toBe(true);
    });
  });
});
