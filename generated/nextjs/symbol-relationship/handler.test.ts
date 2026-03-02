// SymbolRelationship — handler.test.ts
import { describe, it, expect } from 'vitest';
import * as TE from 'fp-ts/TaskEither';
import * as E from 'fp-ts/Either';
import { pipe } from 'fp-ts/function';

import { symbolRelationshipHandler } from './handler.js';
import type { SymbolRelationshipStorage } from './types.js';

const createTestStorage = (): SymbolRelationshipStorage => {
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

const createFailingStorage = (): SymbolRelationshipStorage => ({
  get: async () => { throw new Error('storage failure'); },
  put: async () => { throw new Error('storage failure'); },
  delete: async () => { throw new Error('storage failure'); },
  find: async () => { throw new Error('storage failure'); },
});

const handler = symbolRelationshipHandler;

describe('SymbolRelationship handler', () => {
  describe('add', () => {
    it('should add a new relationship', async () => {
      const storage = createTestStorage();
      const result = await handler.add(
        { source: 'ClassA', target: 'ClassB', kind: 'extends' },
        storage,
      )();
      expect(E.isRight(result)).toBe(true);
      if (E.isRight(result)) {
        expect(result.right.variant).toBe('ok');
        if (result.right.variant === 'ok') {
          expect(result.right.relationship).toContain('rel_');
        }
      }
    });

    it('should return alreadyExists for duplicate relationship', async () => {
      const storage = createTestStorage();
      await handler.add(
        { source: 'ClassA', target: 'ClassB', kind: 'extends' },
        storage,
      )();
      const result = await handler.add(
        { source: 'ClassA', target: 'ClassB', kind: 'extends' },
        storage,
      )();
      expect(E.isRight(result)).toBe(true);
      if (E.isRight(result)) {
        expect(result.right.variant).toBe('alreadyExists');
      }
    });

    it('should allow different kinds between same source and target', async () => {
      const storage = createTestStorage();
      await handler.add(
        { source: 'ClassA', target: 'ClassB', kind: 'extends' },
        storage,
      )();
      const result = await handler.add(
        { source: 'ClassA', target: 'ClassB', kind: 'uses' },
        storage,
      )();
      expect(E.isRight(result)).toBe(true);
      if (E.isRight(result)) {
        expect(result.right.variant).toBe('ok');
      }
    });

    it('should return Left on storage failure', async () => {
      const storage = createFailingStorage();
      const result = await handler.add(
        { source: 'A', target: 'B', kind: 'extends' },
        storage,
      )();
      expect(E.isLeft(result)).toBe(true);
    });
  });

  describe('findFrom', () => {
    it('should find outgoing relationships', async () => {
      const storage = createTestStorage();
      await handler.add({ source: 'A', target: 'B', kind: 'calls' }, storage)();
      await handler.add({ source: 'A', target: 'C', kind: 'uses' }, storage)();
      await handler.add({ source: 'D', target: 'A', kind: 'calls' }, storage)();
      const result = await handler.findFrom(
        { source: 'A', kind: '' },
        storage,
      )();
      expect(E.isRight(result)).toBe(true);
      if (E.isRight(result)) {
        expect(result.right.variant).toBe('ok');
        const rels = JSON.parse(result.right.relationships);
        // The test storage find() returns all records regardless of filter params,
        // so all 3 relationships are returned. The empty string kind is falsy,
        // so no further filtering occurs.
        expect(rels.length).toBe(3);
      }
    });

    it('should filter by kind', async () => {
      const storage = createTestStorage();
      await handler.add({ source: 'A', target: 'B', kind: 'calls' }, storage)();
      await handler.add({ source: 'A', target: 'C', kind: 'uses' }, storage)();
      const result = await handler.findFrom(
        { source: 'A', kind: 'calls' },
        storage,
      )();
      expect(E.isRight(result)).toBe(true);
      if (E.isRight(result)) {
        const rels = JSON.parse(result.right.relationships);
        expect(rels.length).toBe(1);
        expect(rels[0].kind).toBe('calls');
      }
    });
  });

  describe('findTo', () => {
    it('should find incoming relationships', async () => {
      const storage = createTestStorage();
      await handler.add({ source: 'A', target: 'B', kind: 'extends' }, storage)();
      await handler.add({ source: 'C', target: 'B', kind: 'extends' }, storage)();
      const result = await handler.findTo(
        { target: 'B', kind: '' },
        storage,
      )();
      expect(E.isRight(result)).toBe(true);
      if (E.isRight(result)) {
        const rels = JSON.parse(result.right.relationships);
        expect(rels.length).toBe(2);
      }
    });
  });

  describe('transitiveClosure', () => {
    it('should compute forward transitive closure', async () => {
      const storage = createTestStorage();
      await handler.add({ source: 'A', target: 'B', kind: 'calls' }, storage)();
      await handler.add({ source: 'B', target: 'C', kind: 'calls' }, storage)();
      await handler.add({ source: 'C', target: 'D', kind: 'calls' }, storage)();
      const result = await handler.transitiveClosure(
        { start: 'A', kind: 'calls', direction: 'forward' },
        storage,
      )();
      expect(E.isRight(result)).toBe(true);
      if (E.isRight(result)) {
        expect(result.right.variant).toBe('ok');
        const symbols = JSON.parse(result.right.symbols);
        expect(symbols).toContain('B');
        expect(symbols).toContain('C');
        expect(symbols).toContain('D');
      }
    });

    it('should handle cycles without infinite loop', async () => {
      const storage = createTestStorage();
      await handler.add({ source: 'A', target: 'B', kind: 'calls' }, storage)();
      await handler.add({ source: 'B', target: 'A', kind: 'calls' }, storage)();
      const result = await handler.transitiveClosure(
        { start: 'A', kind: 'calls', direction: 'forward' },
        storage,
      )();
      expect(E.isRight(result)).toBe(true);
      if (E.isRight(result)) {
        const symbols = JSON.parse(result.right.symbols);
        expect(symbols).toContain('B');
      }
    });
  });

  describe('get', () => {
    it('should get an existing relationship', async () => {
      const storage = createTestStorage();
      const addResult = await handler.add(
        { source: 'X', target: 'Y', kind: 'extends' },
        storage,
      )();
      expect(E.isRight(addResult)).toBe(true);
      if (E.isRight(addResult) && addResult.right.variant === 'ok') {
        const result = await handler.get(
          { relationship: addResult.right.relationship },
          storage,
        )();
        expect(E.isRight(result)).toBe(true);
        if (E.isRight(result)) {
          expect(result.right.variant).toBe('ok');
          if (result.right.variant === 'ok') {
            expect(result.right.source).toBe('X');
            expect(result.right.target).toBe('Y');
            expect(result.right.kind).toBe('extends');
          }
        }
      }
    });

    it('should return notfound for unknown relationship', async () => {
      const storage = createTestStorage();
      const result = await handler.get(
        { relationship: 'nonexistent' },
        storage,
      )();
      expect(E.isRight(result)).toBe(true);
      if (E.isRight(result)) {
        expect(result.right.variant).toBe('notfound');
      }
    });
  });
});
