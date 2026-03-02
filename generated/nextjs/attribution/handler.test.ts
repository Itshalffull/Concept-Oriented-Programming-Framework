// Attribution — handler.test.ts
// Unit tests for attribution handler actions.

import { describe, it, expect } from 'vitest';
import * as TE from 'fp-ts/TaskEither';
import * as E from 'fp-ts/Either';
import { pipe } from 'fp-ts/function';

import { attributionHandler } from './handler.js';
import type { AttributionStorage } from './types.js';

const createTestStorage = (): AttributionStorage => {
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

const createFailingStorage = (): AttributionStorage => ({
  get: async () => { throw new Error('storage failure'); },
  put: async () => { throw new Error('storage failure'); },
  delete: async () => { throw new Error('storage failure'); },
  find: async () => { throw new Error('storage failure'); },
});

describe('Attribution handler', () => {
  describe('attribute', () => {
    it('records attribution successfully', async () => {
      const storage = createTestStorage();
      const result = await attributionHandler.attribute(
        { contentRef: 'file-1', region: Buffer.from('1:10'), agent: 'user-1', changeRef: 'commit-abc' },
        storage,
      )();
      expect(E.isRight(result)).toBe(true);
      if (E.isRight(result)) {
        expect(result.right.variant).toBe('ok');
        expect(result.right.attributionId).toBeTruthy();
      }
    });

    it('propagates storage errors', async () => {
      const storage = createFailingStorage();
      const result = await attributionHandler.attribute(
        { contentRef: 'file-1', region: Buffer.from('1:10'), agent: 'user-1', changeRef: 'commit-abc' },
        storage,
      )();
      expect(E.isLeft(result)).toBe(true);
    });
  });

  describe('blame', () => {
    it('returns empty map for unattributed content', async () => {
      const storage = createTestStorage();
      const result = await attributionHandler.blame(
        { contentRef: 'nonexistent' },
        storage,
      )();
      expect(E.isRight(result)).toBe(true);
      if (E.isRight(result)) {
        expect(result.right.variant).toBe('ok');
        expect(result.right.map.length).toBe(0);
      }
    });

    it('returns blame map after attribution', async () => {
      const storage = createTestStorage();
      await attributionHandler.attribute(
        { contentRef: 'file-1', region: Buffer.from('1:10'), agent: 'user-1', changeRef: 'commit-abc' },
        storage,
      )();
      const result = await attributionHandler.blame(
        { contentRef: 'file-1' },
        storage,
      )();
      expect(E.isRight(result)).toBe(true);
      if (E.isRight(result)) {
        expect(result.right.variant).toBe('ok');
        expect(result.right.map.length).toBeGreaterThanOrEqual(1);
        expect(result.right.map[0].agent).toBe('user-1');
      }
    });

    it('propagates storage errors', async () => {
      const storage = createFailingStorage();
      const result = await attributionHandler.blame(
        { contentRef: 'file-1' },
        storage,
      )();
      expect(E.isLeft(result)).toBe(true);
    });
  });

  describe('history', () => {
    it('returns notFound for content with no history', async () => {
      const storage = createTestStorage();
      const result = await attributionHandler.history(
        { contentRef: 'nonexistent', region: Buffer.from('1:5') },
        storage,
      )();
      expect(E.isRight(result)).toBe(true);
      if (E.isRight(result)) {
        expect(result.right.variant).toBe('notFound');
      }
    });

    it('returns history chain after attribution', async () => {
      const storage = createTestStorage();
      await attributionHandler.attribute(
        { contentRef: 'file-1', region: Buffer.from('1:10'), agent: 'user-1', changeRef: 'commit-abc' },
        storage,
      )();
      const result = await attributionHandler.history(
        { contentRef: 'file-1', region: Buffer.from('1:10') },
        storage,
      )();
      expect(E.isRight(result)).toBe(true);
      if (E.isRight(result)) {
        expect(result.right.variant).toBe('ok');
        if (result.right.variant === 'ok') {
          expect(result.right.chain.length).toBeGreaterThanOrEqual(1);
        }
      }
    });

    it('propagates storage errors', async () => {
      const storage = createFailingStorage();
      const result = await attributionHandler.history(
        { contentRef: 'file-1', region: Buffer.from('1:5') },
        storage,
      )();
      expect(E.isLeft(result)).toBe(true);
    });
  });

  describe('setOwnership', () => {
    it('sets ownership successfully', async () => {
      const storage = createTestStorage();
      const result = await attributionHandler.setOwnership(
        { pattern: 'src/**/*.ts', owners: ['team-frontend', 'user-1'] },
        storage,
      )();
      expect(E.isRight(result)).toBe(true);
      if (E.isRight(result)) {
        expect(result.right.variant).toBe('ok');
      }
    });

    it('propagates storage errors', async () => {
      const storage = createFailingStorage();
      const result = await attributionHandler.setOwnership(
        { pattern: 'src/**', owners: ['team-1'] },
        storage,
      )();
      expect(E.isLeft(result)).toBe(true);
    });
  });

  describe('queryOwners', () => {
    it('returns noMatch when no ownership rules exist', async () => {
      const storage = createTestStorage();
      const result = await attributionHandler.queryOwners(
        { path: 'src/main.ts' },
        storage,
      )();
      expect(E.isRight(result)).toBe(true);
      if (E.isRight(result)) {
        expect(result.right.variant).toBe('noMatch');
      }
    });

    it('returns owners after setOwnership', async () => {
      const storage = createTestStorage();
      await attributionHandler.setOwnership(
        { pattern: 'src/', owners: ['team-frontend'] },
        storage,
      )();
      const result = await attributionHandler.queryOwners(
        { path: 'src/main.ts' },
        storage,
      )();
      expect(E.isRight(result)).toBe(true);
      if (E.isRight(result)) {
        expect(result.right.variant).toBe('ok');
        if (result.right.variant === 'ok') {
          expect(result.right.owners).toContain('team-frontend');
        }
      }
    });

    it('propagates storage errors', async () => {
      const storage = createFailingStorage();
      const result = await attributionHandler.queryOwners(
        { path: 'src/main.ts' },
        storage,
      )();
      expect(E.isLeft(result)).toBe(true);
    });
  });
});
