// ProgramSlice — handler.test.ts
import { describe, it, expect } from 'vitest';
import * as TE from 'fp-ts/TaskEither';
import * as E from 'fp-ts/Either';
import { pipe } from 'fp-ts/function';

import { programSliceHandler } from './handler.js';
import type { ProgramSliceStorage } from './types.js';

const createTestStorage = (): ProgramSliceStorage => {
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

const createFailingStorage = (): ProgramSliceStorage => ({
  get: async () => { throw new Error('storage failure'); },
  put: async () => { throw new Error('storage failure'); },
  delete: async () => { throw new Error('storage failure'); },
  find: async () => { throw new Error('storage failure'); },
});

const handler = programSliceHandler;

describe('ProgramSlice handler', () => {
  describe('compute', () => {
    it('should return noDependenceData when no edges exist', async () => {
      const storage = createTestStorage();
      const result = await handler.compute(
        { criterion: 'foo', direction: 'forward' },
        storage,
      )();
      expect(E.isRight(result)).toBe(true);
      if (E.isRight(result)) {
        expect(result.right.variant).toBe('noDependenceData');
      }
    });

    it('should compute a forward slice and return ok with a slice id', async () => {
      const storage = createTestStorage();
      // Seed dependency edges: A -> B -> C
      await storage.put('dep_edges', 'e1', { from: 'A', to: 'B', kind: 'data-dep' });
      await storage.put('dep_edges', 'e2', { from: 'B', to: 'C', kind: 'data-dep' });

      const result = await handler.compute(
        { criterion: 'A', direction: 'forward' },
        storage,
      )();
      expect(E.isRight(result)).toBe(true);
      if (E.isRight(result)) {
        expect(result.right.variant).toBe('ok');
        if (result.right.variant === 'ok') {
          expect(result.right.slice).toBeDefined();
          expect(result.right.slice.startsWith('slice-')).toBe(true);
        }
      }
    });

    it('should compute a backward slice', async () => {
      const storage = createTestStorage();
      await storage.put('dep_edges', 'e1', { from: 'A', to: 'B', kind: 'data-dep' });
      await storage.put('dep_edges', 'e2', { from: 'B', to: 'C', kind: 'data-dep' });

      const result = await handler.compute(
        { criterion: 'C', direction: 'backward' },
        storage,
      )();
      expect(E.isRight(result)).toBe(true);
      if (E.isRight(result)) {
        expect(result.right.variant).toBe('ok');
      }
    });

    it('should return left on storage failure', async () => {
      const storage = createFailingStorage();
      const result = await handler.compute(
        { criterion: 'A', direction: 'forward' },
        storage,
      )();
      expect(E.isLeft(result)).toBe(true);
    });
  });

  describe('filesInSlice', () => {
    it('should return empty array for unknown slice', async () => {
      const storage = createTestStorage();
      const result = await handler.filesInSlice({ slice: 'unknown' }, storage)();
      expect(E.isRight(result)).toBe(true);
      if (E.isRight(result)) {
        expect(result.right.variant).toBe('ok');
        expect(JSON.parse(result.right.files)).toEqual([]);
      }
    });

    it('should return files from a stored slice', async () => {
      const storage = createTestStorage();
      await storage.put('slices', 'my-slice', {
        id: 'my-slice',
        criterionSymbol: 'A',
        criterionLocation: 'module.ts',
        direction: 'forward',
        includedSymbols: JSON.stringify(['A', 'B']),
        includedFiles: JSON.stringify(['module.ts', 'util.ts']),
        edgeCount: 1,
      });

      const result = await handler.filesInSlice({ slice: 'my-slice' }, storage)();
      expect(E.isRight(result)).toBe(true);
      if (E.isRight(result)) {
        const files = JSON.parse(result.right.files);
        expect(files).toEqual(['module.ts', 'util.ts']);
      }
    });
  });

  describe('symbolsInSlice', () => {
    it('should return empty array for unknown slice', async () => {
      const storage = createTestStorage();
      const result = await handler.symbolsInSlice({ slice: 'unknown' }, storage)();
      expect(E.isRight(result)).toBe(true);
      if (E.isRight(result)) {
        expect(JSON.parse(result.right.symbols)).toEqual([]);
      }
    });

    it('should return symbols from a stored slice', async () => {
      const storage = createTestStorage();
      await storage.put('slices', 'my-slice', {
        id: 'my-slice',
        criterionSymbol: 'A',
        criterionLocation: 'module.ts',
        direction: 'forward',
        includedSymbols: JSON.stringify(['A', 'B', 'C']),
        includedFiles: JSON.stringify(['module.ts']),
        edgeCount: 2,
      });

      const result = await handler.symbolsInSlice({ slice: 'my-slice' }, storage)();
      expect(E.isRight(result)).toBe(true);
      if (E.isRight(result)) {
        const symbols = JSON.parse(result.right.symbols);
        expect(symbols).toEqual(['A', 'B', 'C']);
      }
    });
  });

  describe('get', () => {
    it('should return notfound for unknown slice', async () => {
      const storage = createTestStorage();
      const result = await handler.get({ slice: 'nonexistent' }, storage)();
      expect(E.isRight(result)).toBe(true);
      if (E.isRight(result)) {
        expect(result.right.variant).toBe('notfound');
      }
    });

    it('should return slice metadata for a stored slice', async () => {
      const storage = createTestStorage();
      await storage.put('slices', 'my-slice', {
        id: 'my-slice',
        criterionSymbol: 'A',
        criterionLocation: 'handler.ts',
        direction: 'forward',
        includedSymbols: JSON.stringify(['A', 'B']),
        includedFiles: JSON.stringify(['handler.ts']),
        edgeCount: 1,
      });

      const result = await handler.get({ slice: 'my-slice' }, storage)();
      expect(E.isRight(result)).toBe(true);
      if (E.isRight(result)) {
        expect(result.right.variant).toBe('ok');
        if (result.right.variant === 'ok') {
          expect(result.right.criterionSymbol).toBe('A');
          expect(result.right.direction).toBe('forward');
          expect(result.right.symbolCount).toBe(2);
          expect(result.right.fileCount).toBe(1);
          expect(result.right.edgeCount).toBe(1);
        }
      }
    });
  });
});
