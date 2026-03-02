// DailyNote — handler.test.ts
// Unit tests for dailyNote handler actions.

import { describe, it, expect } from 'vitest';
import * as E from 'fp-ts/Either';

import { dailyNoteHandler } from './handler.js';
import type { DailyNoteStorage } from './types.js';

const createTestStorage = (): DailyNoteStorage => {
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

const createFailingStorage = (): DailyNoteStorage => ({
  get: async () => { throw new Error('storage failure'); },
  put: async () => { throw new Error('storage failure'); },
  delete: async () => { throw new Error('storage failure'); },
  find: async () => { throw new Error('storage failure'); },
});

describe('DailyNote handler', () => {
  describe('getOrCreateToday', () => {
    it('returns ok with created=true when note does not exist for today', async () => {
      const storage = createTestStorage();
      const result = await dailyNoteHandler.getOrCreateToday(
        { note: 'daily-1' },
        storage,
      )();
      expect(E.isRight(result)).toBe(true);
      if (E.isRight(result)) {
        expect(result.right.variant).toBe('ok');
        expect(result.right.created).toBe(true);
        expect(result.right.note).toBe('daily-1');
      }
    });

    it('returns ok with created=false when note already exists for today', async () => {
      const storage = createTestStorage();
      await dailyNoteHandler.getOrCreateToday({ note: 'daily-1' }, storage)();
      const result = await dailyNoteHandler.getOrCreateToday(
        { note: 'daily-1' },
        storage,
      )();
      expect(E.isRight(result)).toBe(true);
      if (E.isRight(result)) {
        expect(result.right.variant).toBe('ok');
        expect(result.right.created).toBe(false);
      }
    });

    it('returns left on storage failure', async () => {
      const storage = createFailingStorage();
      const result = await dailyNoteHandler.getOrCreateToday(
        { note: 'daily-1' },
        storage,
      )();
      expect(E.isLeft(result)).toBe(true);
    });
  });

  describe('navigateToDate', () => {
    it('returns notfound for invalid date format', async () => {
      const storage = createTestStorage();
      const result = await dailyNoteHandler.navigateToDate(
        { date: 'not-a-date' },
        storage,
      )();
      expect(E.isRight(result)).toBe(true);
      if (E.isRight(result)) {
        expect(result.right.variant).toBe('notfound');
      }
    });

    it('returns notfound when no note exists for given date', async () => {
      const storage = createTestStorage();
      const result = await dailyNoteHandler.navigateToDate(
        { date: '2025-01-15' },
        storage,
      )();
      expect(E.isRight(result)).toBe(true);
      if (E.isRight(result)) {
        expect(result.right.variant).toBe('notfound');
      }
    });

    it('returns left on storage failure with valid date', async () => {
      const storage = createFailingStorage();
      const result = await dailyNoteHandler.navigateToDate(
        { date: '2025-01-15' },
        storage,
      )();
      expect(E.isLeft(result)).toBe(true);
    });
  });

  describe('listRecent', () => {
    it('returns ok with recent notes', async () => {
      const storage = createTestStorage();
      const result = await dailyNoteHandler.listRecent({ count: 5 }, storage)();
      expect(E.isRight(result)).toBe(true);
      if (E.isRight(result)) {
        expect(result.right.variant).toBe('ok');
      }
    });

    it('returns left on storage failure', async () => {
      const storage = createFailingStorage();
      const result = await dailyNoteHandler.listRecent({ count: 5 }, storage)();
      expect(E.isLeft(result)).toBe(true);
    });
  });
});
