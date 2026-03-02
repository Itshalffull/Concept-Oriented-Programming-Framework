// Capture — handler.test.ts
// Unit tests for capture handler actions.

import { describe, it, expect } from 'vitest';
import * as TE from 'fp-ts/TaskEither';
import * as E from 'fp-ts/Either';
import { pipe } from 'fp-ts/function';

import { captureHandler } from './handler.js';
import type { CaptureStorage } from './types.js';

// In-memory test storage
const createTestStorage = (): CaptureStorage => {
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
const createFailingStorage = (): CaptureStorage => ({
  get: async () => { throw new Error('storage failure'); },
  put: async () => { throw new Error('storage failure'); },
  delete: async () => { throw new Error('storage failure'); },
  find: async () => { throw new Error('storage failure'); },
});

describe('Capture handler', () => {
  describe('clip', () => {
    it('should return ok with valid URL and mode', async () => {
      const storage = createTestStorage();

      const result = await captureHandler.clip(
        { url: 'https://example.com/page', mode: 'full', metadata: '{"source":"test"}' },
        storage,
      )();

      expect(E.isRight(result)).toBe(true);
      if (E.isRight(result)) {
        expect(result.right.variant).toBe('ok');
        if (result.right.variant === 'ok') {
          expect(result.right.itemId).toBeTruthy();
          expect(result.right.content).toBeTruthy();
        }
      }
    });

    it('should return error with empty URL', async () => {
      const storage = createTestStorage();

      const result = await captureHandler.clip(
        { url: '', mode: 'full', metadata: '{}' },
        storage,
      )();

      expect(E.isRight(result)).toBe(true);
      if (E.isRight(result)) {
        expect(result.right.variant).toBe('error');
      }
    });

    it('should return error with invalid mode', async () => {
      const storage = createTestStorage();

      const result = await captureHandler.clip(
        { url: 'https://example.com', mode: 'invalid-mode', metadata: '{}' },
        storage,
      )();

      expect(E.isRight(result)).toBe(true);
      if (E.isRight(result)) {
        expect(result.right.variant).toBe('error');
      }
    });

    it('should return Left on storage failure', async () => {
      const storage = createFailingStorage();

      const result = await captureHandler.clip(
        { url: 'https://example.com', mode: 'full', metadata: '{}' },
        storage,
      )();

      expect(E.isLeft(result)).toBe(true);
    });
  });

  describe('import', () => {
    it('should return ok with valid file path', async () => {
      const storage = createTestStorage();

      const result = await captureHandler.import(
        { file: '/data/export.csv', options: '{"delimiter":","}' },
        storage,
      )();

      expect(E.isRight(result)).toBe(true);
      if (E.isRight(result)) {
        expect(result.right.variant).toBe('ok');
        if (result.right.variant === 'ok') {
          expect(result.right.itemId).toBeTruthy();
        }
      }
    });

    it('should return error with empty file path', async () => {
      const storage = createTestStorage();

      const result = await captureHandler.import(
        { file: '', options: '{}' },
        storage,
      )();

      expect(E.isRight(result)).toBe(true);
      if (E.isRight(result)) {
        expect(result.right.variant).toBe('error');
      }
    });

    it('should return Left on storage failure', async () => {
      const storage = createFailingStorage();

      const result = await captureHandler.import(
        { file: '/data/file.csv', options: '{}' },
        storage,
      )();

      expect(E.isLeft(result)).toBe(true);
    });
  });

  describe('subscribe', () => {
    it('should return ok with valid sourceId and schedule', async () => {
      const storage = createTestStorage();

      const result = await captureHandler.subscribe(
        { sourceId: 'source-1', schedule: '5m', mode: 'incremental' },
        storage,
      )();

      expect(E.isRight(result)).toBe(true);
      if (E.isRight(result)) {
        expect(result.right.variant).toBe('ok');
        if (result.right.variant === 'ok') {
          expect(result.right.subscriptionId).toBeTruthy();
        }
      }
    });

    it('should return error with empty sourceId', async () => {
      const storage = createTestStorage();

      const result = await captureHandler.subscribe(
        { sourceId: '', schedule: '5m', mode: 'full' },
        storage,
      )();

      expect(E.isRight(result)).toBe(true);
      if (E.isRight(result)) {
        expect(result.right.variant).toBe('error');
      }
    });

    it('should return error with invalid schedule', async () => {
      const storage = createTestStorage();

      const result = await captureHandler.subscribe(
        { sourceId: 'source-1', schedule: '', mode: 'full' },
        storage,
      )();

      expect(E.isRight(result)).toBe(true);
      if (E.isRight(result)) {
        expect(result.right.variant).toBe('error');
      }
    });

    it('should return error with invalid mode', async () => {
      const storage = createTestStorage();

      const result = await captureHandler.subscribe(
        { sourceId: 'source-1', schedule: '5m', mode: 'invalid' },
        storage,
      )();

      expect(E.isRight(result)).toBe(true);
      if (E.isRight(result)) {
        expect(result.right.variant).toBe('error');
      }
    });

    it('should return Left on storage failure', async () => {
      const storage = createFailingStorage();

      const result = await captureHandler.subscribe(
        { sourceId: 'source-1', schedule: '5m', mode: 'full' },
        storage,
      )();

      expect(E.isLeft(result)).toBe(true);
    });
  });

  describe('detectChanges', () => {
    it('should return empty on first check (lastCheckedAt is null)', async () => {
      const storage = createTestStorage();
      await storage.put('capture_subscriptions', 'sub-1', {
        subscriptionId: 'sub-1',
        sourceId: 'source-1',
        lastCheckedAt: null,
        changeCount: 0,
      });

      const result = await captureHandler.detectChanges(
        { subscriptionId: 'sub-1' },
        storage,
      )();

      expect(E.isRight(result)).toBe(true);
      if (E.isRight(result)) {
        expect(result.right.variant).toBe('empty');
      }
    });

    it('should return ok with changeset on subsequent checks', async () => {
      const storage = createTestStorage();
      await storage.put('capture_subscriptions', 'sub-1', {
        subscriptionId: 'sub-1',
        sourceId: 'source-1',
        lastCheckedAt: '2024-01-01T00:00:00Z',
        changeCount: 0,
      });

      const result = await captureHandler.detectChanges(
        { subscriptionId: 'sub-1' },
        storage,
      )();

      expect(E.isRight(result)).toBe(true);
      if (E.isRight(result)) {
        expect(result.right.variant).toBe('ok');
        if (result.right.variant === 'ok') {
          expect(result.right.changeset).toBeTruthy();
        }
      }
    });

    it('should return notfound when subscription does not exist', async () => {
      const storage = createTestStorage();

      const result = await captureHandler.detectChanges(
        { subscriptionId: 'nonexistent' },
        storage,
      )();

      expect(E.isRight(result)).toBe(true);
      if (E.isRight(result)) {
        expect(result.right.variant).toBe('notfound');
      }
    });

    it('should return Left on storage failure', async () => {
      const storage = createFailingStorage();

      const result = await captureHandler.detectChanges(
        { subscriptionId: 'sub-1' },
        storage,
      )();

      expect(E.isLeft(result)).toBe(true);
    });
  });

  describe('markReady', () => {
    it('should return ok when item exists', async () => {
      const storage = createTestStorage();
      await storage.put('capture_items', 'item-1', {
        itemId: 'item-1',
        status: 'captured',
      });

      const result = await captureHandler.markReady(
        { itemId: 'item-1' },
        storage,
      )();

      expect(E.isRight(result)).toBe(true);
      if (E.isRight(result)) {
        expect(result.right.variant).toBe('ok');
      }
    });

    it('should return notfound when item does not exist', async () => {
      const storage = createTestStorage();

      const result = await captureHandler.markReady(
        { itemId: 'nonexistent' },
        storage,
      )();

      expect(E.isRight(result)).toBe(true);
      if (E.isRight(result)) {
        expect(result.right.variant).toBe('notfound');
      }
    });

    it('should return Left on storage failure', async () => {
      const storage = createFailingStorage();

      const result = await captureHandler.markReady(
        { itemId: 'item-1' },
        storage,
      )();

      expect(E.isLeft(result)).toBe(true);
    });
  });
});
