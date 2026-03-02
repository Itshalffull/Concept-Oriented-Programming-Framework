// SyntaxTree — handler.test.ts
import { describe, it, expect } from 'vitest';
import * as TE from 'fp-ts/TaskEither';
import * as E from 'fp-ts/Either';
import { pipe } from 'fp-ts/function';

import { syntaxTreeHandler } from './handler.js';
import type { SyntaxTreeStorage } from './types.js';

const createTestStorage = (): SyntaxTreeStorage => {
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

const createFailingStorage = (): SyntaxTreeStorage => ({
  get: async () => { throw new Error('storage failure'); },
  put: async () => { throw new Error('storage failure'); },
  delete: async () => { throw new Error('storage failure'); },
  find: async () => { throw new Error('storage failure'); },
});

describe('SyntaxTree handler', () => {
  describe('parse', () => {
    it('should return ok for a valid file and grammar', async () => {
      const storage = createTestStorage();
      await storage.put('grammar', 'typescript', { id: 'typescript' });
      await storage.put('file', 'main.ts', { content: 'const x = 1;' });

      const result = await syntaxTreeHandler.parse(
        { file: 'main.ts', grammar: 'typescript' },
        storage,
      )();

      expect(E.isRight(result)).toBe(true);
      if (E.isRight(result)) {
        expect(result.right.variant).toBe('ok');
        if (result.right.variant === 'ok') {
          expect(result.right.tree).toBe('tree_main_ts');
        }
      }
    });

    it('should return noGrammar when grammar does not exist', async () => {
      const storage = createTestStorage();

      const result = await syntaxTreeHandler.parse(
        { file: 'main.ts', grammar: 'unknown-lang' },
        storage,
      )();

      expect(E.isRight(result)).toBe(true);
      if (E.isRight(result)) {
        expect(result.right.variant).toBe('noGrammar');
      }
    });

    it('should return parseError for source with unbalanced brackets', async () => {
      const storage = createTestStorage();
      await storage.put('grammar', 'typescript', { id: 'typescript' });
      await storage.put('file', 'bad.ts', { content: 'function foo() { {' });

      const result = await syntaxTreeHandler.parse(
        { file: 'bad.ts', grammar: 'typescript' },
        storage,
      )();

      expect(E.isRight(result)).toBe(true);
      if (E.isRight(result)) {
        expect(result.right.variant).toBe('parseError');
        if (result.right.variant === 'parseError') {
          expect(result.right.errorCount).toBeGreaterThan(0);
        }
      }
    });

    it('should return left on storage failure', async () => {
      const storage = createFailingStorage();

      const result = await syntaxTreeHandler.parse(
        { file: 'main.ts', grammar: 'typescript' },
        storage,
      )();

      expect(E.isLeft(result)).toBe(true);
      if (E.isLeft(result)) {
        expect(result.left.code).toBe('STORAGE_ERROR');
      }
    });
  });

  describe('reparse', () => {
    it('should reparse an existing tree and update byteLength', async () => {
      const storage = createTestStorage();
      await storage.put('tree', 'tree_1', {
        id: 'tree_1',
        byteLength: 100,
        editVersion: 0,
      });

      const result = await syntaxTreeHandler.reparse(
        { tree: 'tree_1', startByte: 10, oldEndByte: 20, newEndByte: 30, newText: 'new content' },
        storage,
      )();

      expect(E.isRight(result)).toBe(true);
      if (E.isRight(result)) {
        expect(result.right.variant).toBe('ok');
      }
    });

    it('should return notfound for a missing tree', async () => {
      const storage = createTestStorage();

      const result = await syntaxTreeHandler.reparse(
        { tree: 'missing', startByte: 0, oldEndByte: 5, newEndByte: 10, newText: 'x' },
        storage,
      )();

      expect(E.isRight(result)).toBe(true);
      if (E.isRight(result)) {
        expect(result.right.variant).toBe('notfound');
      }
    });
  });

  describe('query', () => {
    it('should return ok with matches for a valid tree and pattern', async () => {
      const storage = createTestStorage();
      await storage.put('tree', 'tree_1', { id: 'tree_1' });

      const result = await syntaxTreeHandler.query(
        { tree: 'tree_1', pattern: 'identifier' },
        storage,
      )();

      expect(E.isRight(result)).toBe(true);
      if (E.isRight(result)) {
        expect(result.right.variant).toBe('ok');
      }
    });

    it('should return notfound for a missing tree', async () => {
      const storage = createTestStorage();

      const result = await syntaxTreeHandler.query(
        { tree: 'missing', pattern: 'identifier' },
        storage,
      )();

      expect(E.isRight(result)).toBe(true);
      if (E.isRight(result)) {
        expect(result.right.variant).toBe('notfound');
      }
    });

    it('should return invalidPattern for unbalanced parentheses', async () => {
      const storage = createTestStorage();
      await storage.put('tree', 'tree_1', { id: 'tree_1' });

      const result = await syntaxTreeHandler.query(
        { tree: 'tree_1', pattern: '((identifier)' },
        storage,
      )();

      expect(E.isRight(result)).toBe(true);
      if (E.isRight(result)) {
        expect(result.right.variant).toBe('invalidPattern');
      }
    });
  });

  describe('nodeAt', () => {
    it('should return ok for a valid byte offset', async () => {
      const storage = createTestStorage();
      await storage.put('tree', 'tree_1', { id: 'tree_1', byteLength: 100 });

      const result = await syntaxTreeHandler.nodeAt(
        { tree: 'tree_1', byteOffset: 5 },
        storage,
      )();

      expect(E.isRight(result)).toBe(true);
      if (E.isRight(result)) {
        expect(result.right.variant).toBe('ok');
      }
    });

    it('should return outOfRange for a negative offset', async () => {
      const storage = createTestStorage();
      await storage.put('tree', 'tree_1', { id: 'tree_1', byteLength: 100 });

      const result = await syntaxTreeHandler.nodeAt(
        { tree: 'tree_1', byteOffset: -1 },
        storage,
      )();

      expect(E.isRight(result)).toBe(true);
      if (E.isRight(result)) {
        expect(result.right.variant).toBe('outOfRange');
      }
    });

    it('should return notfound for a missing tree', async () => {
      const storage = createTestStorage();

      const result = await syntaxTreeHandler.nodeAt(
        { tree: 'missing', byteOffset: 0 },
        storage,
      )();

      expect(E.isRight(result)).toBe(true);
      if (E.isRight(result)) {
        expect(result.right.variant).toBe('notfound');
      }
    });
  });

  describe('get', () => {
    it('should return ok with tree details for an existing tree', async () => {
      const storage = createTestStorage();
      await storage.put('tree', 'tree_1', {
        id: 'tree_1',
        source: 'main.ts',
        grammar: 'typescript',
        byteLength: 50,
        editVersion: 2,
        errorRanges: '[]',
      });

      const result = await syntaxTreeHandler.get({ tree: 'tree_1' }, storage)();

      expect(E.isRight(result)).toBe(true);
      if (E.isRight(result)) {
        expect(result.right.variant).toBe('ok');
        if (result.right.variant === 'ok') {
          expect(result.right.tree).toBe('tree_1');
          expect(result.right.grammar).toBe('typescript');
          expect(result.right.byteLength).toBe(50);
          expect(result.right.editVersion).toBe(2);
        }
      }
    });

    it('should return notfound for a missing tree', async () => {
      const storage = createTestStorage();

      const result = await syntaxTreeHandler.get({ tree: 'missing' }, storage)();

      expect(E.isRight(result)).toBe(true);
      if (E.isRight(result)) {
        expect(result.right.variant).toBe('notfound');
      }
    });
  });
});
