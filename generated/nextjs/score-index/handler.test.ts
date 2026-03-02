// ScoreIndex — handler.test.ts
import { describe, it, expect } from 'vitest';
import * as TE from 'fp-ts/TaskEither';
import * as E from 'fp-ts/Either';
import { pipe } from 'fp-ts/function';

import { scoreIndexHandler } from './handler.js';
import type { ScoreIndexStorage } from './types.js';

const createTestStorage = (): ScoreIndexStorage => {
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

const createFailingStorage = (): ScoreIndexStorage => ({
  get: async () => { throw new Error('storage failure'); },
  put: async () => { throw new Error('storage failure'); },
  delete: async () => { throw new Error('storage failure'); },
  find: async () => { throw new Error('storage failure'); },
});

const handler = scoreIndexHandler;

describe('ScoreIndex handler', () => {
  describe('upsertConcept', () => {
    it('should upsert a concept and return index key', async () => {
      const storage = createTestStorage();
      const result = await handler.upsertConcept(
        { name: 'Order', purpose: 'Manage orders', actions: ['create', 'get'], stateFields: ['orders'], file: 'order.concept' },
        storage,
      )();
      expect(E.isRight(result)).toBe(true);
      if (E.isRight(result)) {
        expect(result.right.variant).toBe('ok');
        if (result.right.variant === 'ok') {
          expect(result.right.index).toBe('concept::Order');
        }
      }
    });

    it('should return error for empty name', async () => {
      const storage = createTestStorage();
      const result = await handler.upsertConcept(
        { name: '', purpose: '', actions: [], stateFields: [], file: '' },
        storage,
      )();
      expect(E.isRight(result)).toBe(true);
      if (E.isRight(result)) {
        expect(result.right.variant).toBe('error');
      }
    });

    it('should return left on storage failure', async () => {
      const storage = createFailingStorage();
      const result = await handler.upsertConcept(
        { name: 'X', purpose: '', actions: [], stateFields: [], file: '' },
        storage,
      )();
      expect(E.isLeft(result)).toBe(true);
    });
  });

  describe('upsertSync', () => {
    it('should upsert a sync and return index key', async () => {
      const storage = createTestStorage();
      const result = await handler.upsertSync(
        { name: 'order-notify', annotation: 'after', triggers: ['Order.create'], effects: ['Notification.send'], file: 'sync.clef' },
        storage,
      )();
      expect(E.isRight(result)).toBe(true);
      if (E.isRight(result)) {
        expect(result.right.variant).toBe('ok');
        if (result.right.variant === 'ok') {
          expect(result.right.index).toBe('sync::order-notify');
        }
      }
    });

    it('should return error for empty name', async () => {
      const storage = createTestStorage();
      const result = await handler.upsertSync(
        { name: '  ', annotation: '', triggers: [], effects: [], file: '' },
        storage,
      )();
      expect(E.isRight(result)).toBe(true);
      if (E.isRight(result)) {
        expect(result.right.variant).toBe('error');
      }
    });
  });

  describe('upsertSymbol', () => {
    it('should upsert a symbol and return index key', async () => {
      const storage = createTestStorage();
      const result = await handler.upsertSymbol(
        { name: 'UserService', kind: 'class', file: 'user.ts', line: 10, scope: 'global' },
        storage,
      )();
      expect(E.isRight(result)).toBe(true);
      if (E.isRight(result)) {
        expect(result.right.variant).toBe('ok');
        if (result.right.variant === 'ok') {
          expect(result.right.index).toBe('symbol::global::UserService');
        }
      }
    });

    it('should return error for empty name', async () => {
      const storage = createTestStorage();
      const result = await handler.upsertSymbol(
        { name: '', kind: '', file: '', line: 0, scope: '' },
        storage,
      )();
      expect(E.isRight(result)).toBe(true);
      if (E.isRight(result)) {
        expect(result.right.variant).toBe('error');
      }
    });
  });

  describe('upsertFile', () => {
    it('should upsert a file and return index key', async () => {
      const storage = createTestStorage();
      const result = await handler.upsertFile(
        { path: 'src/main.ts', language: 'ts', role: 'source', definitions: ['main'] },
        storage,
      )();
      expect(E.isRight(result)).toBe(true);
      if (E.isRight(result)) {
        expect(result.right.variant).toBe('ok');
        if (result.right.variant === 'ok') {
          expect(result.right.index).toBe('file::src/main.ts');
        }
      }
    });

    it('should return error for empty path', async () => {
      const storage = createTestStorage();
      const result = await handler.upsertFile(
        { path: '', language: '', role: '', definitions: [] },
        storage,
      )();
      expect(E.isRight(result)).toBe(true);
      if (E.isRight(result)) {
        expect(result.right.variant).toBe('error');
      }
    });
  });

  describe('removeByFile', () => {
    it('should remove file and associated symbols', async () => {
      const storage = createTestStorage();
      await handler.upsertFile(
        { path: 'src/main.ts', language: 'ts', role: 'source', definitions: [] },
        storage,
      )();
      await handler.upsertSymbol(
        { name: 'main', kind: 'function', file: 'src/main.ts', line: 1, scope: 'global' },
        storage,
      )();
      const result = await handler.removeByFile({ path: 'src/main.ts' }, storage)();
      expect(E.isRight(result)).toBe(true);
      if (E.isRight(result)) {
        expect(result.right.variant).toBe('ok');
        expect(result.right.removed).toBeGreaterThan(0);
      }
    });
  });

  describe('clear', () => {
    it('should clear all indexed records', async () => {
      const storage = createTestStorage();
      await handler.upsertConcept(
        { name: 'Order', purpose: '', actions: [], stateFields: [], file: '' },
        storage,
      )();
      await handler.upsertFile(
        { path: 'a.ts', language: 'ts', role: 'source', definitions: [] },
        storage,
      )();
      const result = await handler.clear({}, storage)();
      expect(E.isRight(result)).toBe(true);
      if (E.isRight(result)) {
        expect(result.right.variant).toBe('ok');
        expect(result.right.cleared).toBeGreaterThan(0);
      }
    });
  });

  describe('stats', () => {
    it('should return index statistics', async () => {
      const storage = createTestStorage();
      await handler.upsertConcept(
        { name: 'Order', purpose: '', actions: [], stateFields: [], file: '' },
        storage,
      )();
      await handler.upsertSync(
        { name: 'order-sync', annotation: '', triggers: [], effects: [], file: '' },
        storage,
      )();
      const result = await handler.stats({}, storage)();
      expect(E.isRight(result)).toBe(true);
      if (E.isRight(result)) {
        expect(result.right.variant).toBe('ok');
        expect(result.right.conceptCount).toBe(1);
        expect(result.right.syncCount).toBe(1);
      }
    });

    it('should return left on storage failure', async () => {
      const storage = createFailingStorage();
      const result = await handler.stats({}, storage)();
      expect(E.isLeft(result)).toBe(true);
    });
  });
});
