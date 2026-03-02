// ApiSurface — handler.test.ts
// Unit tests for apiSurface handler actions.

import { describe, it, expect } from 'vitest';
import * as TE from 'fp-ts/TaskEither';
import * as E from 'fp-ts/Either';
import { pipe } from 'fp-ts/function';

import { apiSurfaceHandler } from './handler.js';
import type { ApiSurfaceStorage } from './types.js';

const createTestStorage = (): ApiSurfaceStorage => {
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

const createFailingStorage = (): ApiSurfaceStorage => ({
  get: async () => { throw new Error('storage failure'); },
  put: async () => { throw new Error('storage failure'); },
  delete: async () => { throw new Error('storage failure'); },
  find: async () => { throw new Error('storage failure'); },
});

describe('ApiSurface handler', () => {
  describe('compose', () => {
    it('composes successfully with valid input', async () => {
      const storage = createTestStorage();
      const result = await apiSurfaceHandler.compose(
        { kit: 'identity', target: 'nextjs', outputs: ['user/create', 'user/get'] },
        storage,
      )();
      expect(E.isRight(result)).toBe(true);
      if (E.isRight(result)) {
        expect(result.right.variant).toBe('ok');
        if (result.right.variant === 'ok') {
          expect(result.right.conceptCount).toBe(2);
          expect(result.right.entrypoint).toContain('nextjs');
        }
      }
    });

    it('detects conflicting routes', async () => {
      const storage = createTestStorage();
      // Pre-populate with existing output that will conflict
      await storage.put('concept-outputs', 'o1', { path: 'user/create', kit: 'identity' });
      const result = await apiSurfaceHandler.compose(
        { kit: 'identity', target: 'nextjs', outputs: ['user/create'] },
        storage,
      )();
      expect(E.isRight(result)).toBe(true);
      if (E.isRight(result)) {
        expect(result.right.variant).toBe('conflictingRoutes');
      }
    });

    it('propagates storage errors', async () => {
      const storage = createFailingStorage();
      const result = await apiSurfaceHandler.compose(
        { kit: 'identity', target: 'nextjs', outputs: ['user/create'] },
        storage,
      )();
      expect(E.isLeft(result)).toBe(true);
    });
  });

  describe('entrypoint', () => {
    it('returns stub content for missing surface', async () => {
      const storage = createTestStorage();
      const result = await apiSurfaceHandler.entrypoint(
        { surface: 'nonexistent-surface' },
        storage,
      )();
      expect(E.isRight(result)).toBe(true);
      if (E.isRight(result)) {
        expect(result.right.variant).toBe('ok');
        expect(result.right.content).toContain('not found');
      }
    });

    it('returns generated entrypoint after compose', async () => {
      const storage = createTestStorage();
      const composeResult = await apiSurfaceHandler.compose(
        { kit: 'identity', target: 'nextjs', outputs: ['user/create', 'user/get'] },
        storage,
      )();
      expect(E.isRight(composeResult)).toBe(true);
      if (E.isRight(composeResult) && composeResult.right.variant === 'ok') {
        const result = await apiSurfaceHandler.entrypoint(
          { surface: composeResult.right.surface },
          storage,
        )();
        expect(E.isRight(result)).toBe(true);
        if (E.isRight(result)) {
          expect(result.right.variant).toBe('ok');
          expect(result.right.content).toContain('export');
        }
      }
    });

    it('propagates storage errors', async () => {
      const storage = createFailingStorage();
      const result = await apiSurfaceHandler.entrypoint(
        { surface: 'test-surface' },
        storage,
      )();
      expect(E.isLeft(result)).toBe(true);
    });
  });
});
