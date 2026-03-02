// ScopeGraph — handler.test.ts
import { describe, it, expect } from 'vitest';
import * as TE from 'fp-ts/TaskEither';
import * as E from 'fp-ts/Either';
import { pipe } from 'fp-ts/function';

import { scopeGraphHandler } from './handler.js';
import type { ScopeGraphStorage } from './types.js';

const createTestStorage = (): ScopeGraphStorage => {
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

const createFailingStorage = (): ScopeGraphStorage => ({
  get: async () => { throw new Error('storage failure'); },
  put: async () => { throw new Error('storage failure'); },
  delete: async () => { throw new Error('storage failure'); },
  find: async () => { throw new Error('storage failure'); },
});

const handler = scopeGraphHandler;

describe('ScopeGraph handler', () => {
  describe('build', () => {
    it('should build a scope graph from a supported file', async () => {
      const storage = createTestStorage();
      const tree = JSON.stringify({
        scopes: [{ id: 'global', parentId: null }],
        declarations: [{ name: 'foo', symbol: 'foo', scopeId: 'global', exported: true }],
        references: [],
        imports: [],
      });
      const result = await handler.build({ file: 'main.ts', tree }, storage)();
      expect(E.isRight(result)).toBe(true);
      if (E.isRight(result)) {
        expect(result.right.variant).toBe('ok');
        if (result.right.variant === 'ok') {
          expect(result.right.graph.length).toBeGreaterThan(0);
        }
      }
    });

    it('should return unsupportedLanguage for unknown extensions', async () => {
      const storage = createTestStorage();
      const result = await handler.build({ file: 'data.csv', tree: '{}' }, storage)();
      expect(E.isRight(result)).toBe(true);
      if (E.isRight(result)) {
        expect(result.right.variant).toBe('unsupportedLanguage');
        if (result.right.variant === 'unsupportedLanguage') {
          expect(result.right.language).toBe('csv');
        }
      }
    });

    it('should handle non-JSON tree input gracefully', async () => {
      const storage = createTestStorage();
      const result = await handler.build({ file: 'app.js', tree: 'not-json' }, storage)();
      expect(E.isRight(result)).toBe(true);
      if (E.isRight(result)) {
        expect(result.right.variant).toBe('ok');
      }
    });

    it('should return left on storage failure', async () => {
      const storage = createFailingStorage();
      const tree = JSON.stringify({ scopes: [{ id: 'g', parentId: null }] });
      const result = await handler.build({ file: 'main.ts', tree }, storage)();
      expect(E.isLeft(result)).toBe(true);
    });
  });

  describe('resolveReference', () => {
    it('should resolve a declared symbol', async () => {
      const storage = createTestStorage();
      const tree = JSON.stringify({
        scopes: [{ id: 'global', parentId: null }],
        declarations: [{ name: 'User', symbol: 'User_type', scopeId: 'global', exported: true }],
        references: [{ name: 'User', scopeId: 'global' }],
      });
      const buildResult = await handler.build({ file: 'types.ts', tree }, storage)();
      expect(E.isRight(buildResult)).toBe(true);
      if (!E.isRight(buildResult) || buildResult.right.variant !== 'ok') return;
      const graphId = buildResult.right.graph;

      const result = await handler.resolveReference(
        { graph: graphId, scope: 'global', name: 'User' },
        storage,
      )();
      expect(E.isRight(result)).toBe(true);
      if (E.isRight(result)) {
        expect(result.right.variant).toBe('ok');
        if (result.right.variant === 'ok') {
          expect(result.right.symbol).toBe('User_type');
        }
      }
    });

    it('should return unresolved for unknown symbols', async () => {
      const storage = createTestStorage();
      const tree = JSON.stringify({
        scopes: [{ id: 'global', parentId: null }],
        declarations: [],
        references: [],
      });
      const buildResult = await handler.build({ file: 'empty.ts', tree }, storage)();
      expect(E.isRight(buildResult)).toBe(true);
      if (!E.isRight(buildResult) || buildResult.right.variant !== 'ok') return;
      const graphId = buildResult.right.graph;

      const result = await handler.resolveReference(
        { graph: graphId, scope: 'global', name: 'Unknown' },
        storage,
      )();
      expect(E.isRight(result)).toBe(true);
      if (E.isRight(result)) {
        expect(result.right.variant).toBe('unresolved');
      }
    });

    it('should return ambiguous when multiple declarations match', async () => {
      const storage = createTestStorage();
      const tree = JSON.stringify({
        scopes: [{ id: 'global', parentId: null }],
        declarations: [
          { name: 'Item', symbol: 'Item_1', scopeId: 'global', exported: true },
          { name: 'Item', symbol: 'Item_2', scopeId: 'global', exported: true },
        ],
        references: [],
      });
      const buildResult = await handler.build({ file: 'ambig.ts', tree }, storage)();
      expect(E.isRight(buildResult)).toBe(true);
      if (!E.isRight(buildResult) || buildResult.right.variant !== 'ok') return;
      const graphId = buildResult.right.graph;

      const result = await handler.resolveReference(
        { graph: graphId, scope: 'global', name: 'Item' },
        storage,
      )();
      expect(E.isRight(result)).toBe(true);
      if (E.isRight(result)) {
        expect(result.right.variant).toBe('ambiguous');
      }
    });
  });

  describe('visibleSymbols', () => {
    it('should list visible declarations from scope', async () => {
      const storage = createTestStorage();
      const tree = JSON.stringify({
        scopes: [{ id: 'global', parentId: null }],
        declarations: [
          { name: 'foo', symbol: 'foo', scopeId: 'global', exported: false },
          { name: 'bar', symbol: 'bar', scopeId: 'global', exported: true },
        ],
        references: [],
      });
      const buildResult = await handler.build({ file: 'lib.ts', tree }, storage)();
      expect(E.isRight(buildResult)).toBe(true);
      if (!E.isRight(buildResult) || buildResult.right.variant !== 'ok') return;
      const graphId = buildResult.right.graph;

      const result = await handler.visibleSymbols({ graph: graphId, scope: 'global' }, storage)();
      expect(E.isRight(result)).toBe(true);
      if (E.isRight(result)) {
        expect(result.right.variant).toBe('ok');
        const symbols = JSON.parse(result.right.symbols);
        expect(symbols.length).toBe(2);
      }
    });
  });

  describe('resolveCrossFile', () => {
    it('should return noUnresolved when no references exist', async () => {
      const storage = createTestStorage();
      const tree = JSON.stringify({
        scopes: [{ id: 'global', parentId: null }],
        declarations: [{ name: 'A', symbol: 'A', scopeId: 'global', exported: true }],
        references: [],
      });
      const buildResult = await handler.build({ file: 'a.ts', tree }, storage)();
      expect(E.isRight(buildResult)).toBe(true);
      if (!E.isRight(buildResult) || buildResult.right.variant !== 'ok') return;
      const graphId = buildResult.right.graph;

      const result = await handler.resolveCrossFile({ graph: graphId }, storage)();
      expect(E.isRight(result)).toBe(true);
      if (E.isRight(result)) {
        expect(result.right.variant).toBe('noUnresolved');
      }
    });
  });

  describe('get', () => {
    it('should return scope graph metadata', async () => {
      const storage = createTestStorage();
      const tree = JSON.stringify({
        scopes: [{ id: 'global', parentId: null }, { id: 'fn', parentId: 'global' }],
        declarations: [{ name: 'x', symbol: 'x', scopeId: 'fn', exported: false }],
        references: [{ name: 'y', scopeId: 'fn' }],
      });
      const buildResult = await handler.build({ file: 'main.ts', tree }, storage)();
      expect(E.isRight(buildResult)).toBe(true);
      if (!E.isRight(buildResult) || buildResult.right.variant !== 'ok') return;
      const graphId = buildResult.right.graph;

      const result = await handler.get({ graph: graphId }, storage)();
      expect(E.isRight(result)).toBe(true);
      if (E.isRight(result)) {
        expect(result.right.variant).toBe('ok');
        if (result.right.variant === 'ok') {
          expect(result.right.file).toBe('main.ts');
          expect(result.right.scopeCount).toBe(2);
          expect(result.right.declarationCount).toBe(1);
          expect(result.right.unresolvedCount).toBe(1);
        }
      }
    });

    it('should return notfound for non-existent graph', async () => {
      const storage = createTestStorage();
      const result = await handler.get({ graph: 'nonexistent' }, storage)();
      expect(E.isRight(result)).toBe(true);
      if (E.isRight(result)) {
        expect(result.right.variant).toBe('notfound');
      }
    });
  });
});
