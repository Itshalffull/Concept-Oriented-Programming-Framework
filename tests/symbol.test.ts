// ============================================================
// Symbol Handler Tests
//
// Tests for globally unique, cross-file identifier registration,
// resolution, querying, renaming, and retrieval.
// ============================================================

import { describe, it, expect, beforeEach } from 'vitest';
import { createInMemoryStorage } from '../kernel/src/storage.js';
import { symbolHandler, resetSymbolCounter } from '../implementations/typescript/symbol.impl.js';

describe('Symbol', () => {
  let storage: ReturnType<typeof createInMemoryStorage>;

  beforeEach(() => {
    storage = createInMemoryStorage();
    resetSymbolCounter();
  });

  // ── register ──────────────────────────────────────────────

  describe('register', () => {
    it('registers a symbol and returns ok with an id', async () => {
      const result = await symbolHandler.register({
        symbolString: 'copf/concept/Article',
        kind: 'concept',
        displayName: 'Article',
        definingFile: 'article.concept',
      }, storage);

      expect(result.variant).toBe('ok');
      expect(result.symbol).toBeDefined();
    });

    it('derives namespace from symbolString', async () => {
      await symbolHandler.register({
        symbolString: 'copf/concept/Article',
        kind: 'concept',
        displayName: 'Article',
        definingFile: 'article.concept',
      }, storage);

      const getResult = await symbolHandler.get({ symbol: 'symbol-1' }, storage);
      expect(getResult.variant).toBe('ok');
      expect(getResult.namespace).toBe('copf/concept');
    });

    it('derives empty namespace for single-segment symbolString', async () => {
      await symbolHandler.register({
        symbolString: 'Article',
        kind: 'concept',
        displayName: 'Article',
        definingFile: 'article.concept',
      }, storage);

      const getResult = await symbolHandler.get({ symbol: 'symbol-1' }, storage);
      expect(getResult.namespace).toBe('');
    });

    it('rejects duplicate symbolString with alreadyExists', async () => {
      await symbolHandler.register({
        symbolString: 'copf/concept/Article',
        kind: 'concept',
        displayName: 'Article',
        definingFile: 'article.concept',
      }, storage);

      const result = await symbolHandler.register({
        symbolString: 'copf/concept/Article',
        kind: 'concept',
        displayName: 'Article',
        definingFile: 'other.concept',
      }, storage);

      expect(result.variant).toBe('alreadyExists');
      expect(result.existing).toBe('symbol-1');
    });

    it('assigns sequential ids', async () => {
      const r1 = await symbolHandler.register({
        symbolString: 'copf/concept/A',
        kind: 'concept',
        displayName: 'A',
        definingFile: 'a.concept',
      }, storage);
      const r2 = await symbolHandler.register({
        symbolString: 'copf/concept/B',
        kind: 'concept',
        displayName: 'B',
        definingFile: 'b.concept',
      }, storage);

      expect(r1.symbol).toBe('symbol-1');
      expect(r2.symbol).toBe('symbol-2');
    });
  });

  // ── resolve ───────────────────────────────────────────────

  describe('resolve', () => {
    it('resolves an existing symbolString to its id', async () => {
      await symbolHandler.register({
        symbolString: 'ts/function/src/handler.ts/create',
        kind: 'function',
        displayName: 'create',
        definingFile: 'src/handler.ts',
      }, storage);

      const result = await symbolHandler.resolve({
        symbolString: 'ts/function/src/handler.ts/create',
      }, storage);

      expect(result.variant).toBe('ok');
      expect(result.symbol).toBe('symbol-1');
    });

    it('returns notfound for unknown symbolString', async () => {
      const result = await symbolHandler.resolve({
        symbolString: 'copf/concept/NonExistent',
      }, storage);

      expect(result.variant).toBe('notfound');
    });
  });

  // ── findByKind ────────────────────────────────────────────

  describe('findByKind', () => {
    beforeEach(async () => {
      await symbolHandler.register({
        symbolString: 'copf/concept/Article',
        kind: 'concept',
        displayName: 'Article',
        definingFile: 'article.concept',
      }, storage);
      await symbolHandler.register({
        symbolString: 'ts/function/src/handler.ts/create',
        kind: 'function',
        displayName: 'create',
        definingFile: 'src/handler.ts',
      }, storage);
      await symbolHandler.register({
        symbolString: 'copf/concept/Comment',
        kind: 'concept',
        displayName: 'Comment',
        definingFile: 'comment.concept',
      }, storage);
    });

    it('filters by kind', async () => {
      const result = await symbolHandler.findByKind({ kind: 'concept', namespace: '' }, storage);
      expect(result.variant).toBe('ok');
      const symbols = JSON.parse(result.symbols as string);
      expect(symbols).toHaveLength(2);
      expect(symbols.every((s: Record<string, unknown>) => s.kind === 'concept')).toBe(true);
    });

    it('filters by namespace', async () => {
      const result = await symbolHandler.findByKind({ kind: '', namespace: 'copf/concept' }, storage);
      expect(result.variant).toBe('ok');
      const symbols = JSON.parse(result.symbols as string);
      expect(symbols).toHaveLength(2);
    });

    it('returns all symbols when no filters provided', async () => {
      const result = await symbolHandler.findByKind({ kind: '', namespace: '' }, storage);
      expect(result.variant).toBe('ok');
      const symbols = JSON.parse(result.symbols as string);
      expect(symbols).toHaveLength(3);
    });
  });

  // ── findByFile ────────────────────────────────────────────

  describe('findByFile', () => {
    it('returns symbols defined in a specific file', async () => {
      await symbolHandler.register({
        symbolString: 'ts/function/src/handler.ts/create',
        kind: 'function',
        displayName: 'create',
        definingFile: 'src/handler.ts',
      }, storage);
      await symbolHandler.register({
        symbolString: 'ts/function/src/handler.ts/update',
        kind: 'function',
        displayName: 'update',
        definingFile: 'src/handler.ts',
      }, storage);
      await symbolHandler.register({
        symbolString: 'ts/function/src/other.ts/delete',
        kind: 'function',
        displayName: 'delete',
        definingFile: 'src/other.ts',
      }, storage);

      const result = await symbolHandler.findByFile({ file: 'src/handler.ts' }, storage);
      expect(result.variant).toBe('ok');
      const symbols = JSON.parse(result.symbols as string);
      expect(symbols).toHaveLength(2);
    });
  });

  // ── rename ────────────────────────────────────────────────

  describe('rename', () => {
    it('renames a symbol and updates its symbolString', async () => {
      await symbolHandler.register({
        symbolString: 'copf/concept/Article',
        kind: 'concept',
        displayName: 'Article',
        definingFile: 'article.concept',
      }, storage);

      const result = await symbolHandler.rename({ symbol: 'symbol-1', newName: 'Post' }, storage);
      expect(result.variant).toBe('ok');
      expect(result.oldName).toBe('Article');

      const getResult = await symbolHandler.get({ symbol: 'symbol-1' }, storage);
      expect(getResult.displayName).toBe('Post');
      expect(getResult.symbolString).toBe('copf/concept/Post');
      expect(getResult.namespace).toBe('copf/concept');
    });

    it('returns notfound when symbol does not exist', async () => {
      const result = await symbolHandler.rename({ symbol: 'nonexistent', newName: 'X' }, storage);
      expect(result.variant).toBe('notfound');
    });

    it('returns conflict when new name collides', async () => {
      await symbolHandler.register({
        symbolString: 'copf/concept/Article',
        kind: 'concept',
        displayName: 'Article',
        definingFile: 'article.concept',
      }, storage);
      await symbolHandler.register({
        symbolString: 'copf/concept/Post',
        kind: 'concept',
        displayName: 'Post',
        definingFile: 'post.concept',
      }, storage);

      const result = await symbolHandler.rename({ symbol: 'symbol-1', newName: 'Post' }, storage);
      expect(result.variant).toBe('conflict');
      expect(result.conflicting).toBe('symbol-2');
    });

    it('updates occurrences that reference the renamed symbol', async () => {
      await symbolHandler.register({
        symbolString: 'copf/concept/Article',
        kind: 'concept',
        displayName: 'Article',
        definingFile: 'article.concept',
      }, storage);

      // Manually store an occurrence referencing the old symbol string
      await storage.put('symbol-occurrence', 'occ-1', {
        id: 'occ-1',
        symbol: 'copf/concept/Article',
        file: 'test.ts',
        startRow: 1, startCol: 1, endRow: 1, endCol: 8,
        startByte: 0, endByte: 7,
        role: 'reference',
      });

      const result = await symbolHandler.rename({ symbol: 'symbol-1', newName: 'Post' }, storage);
      expect(result.variant).toBe('ok');
      expect(result.occurrencesUpdated).toBe(1);

      const occ = await storage.get('symbol-occurrence', 'occ-1');
      expect(occ?.symbol).toBe('copf/concept/Post');
    });
  });

  // ── get ───────────────────────────────────────────────────

  describe('get', () => {
    it('retrieves full symbol details', async () => {
      await symbolHandler.register({
        symbolString: 'copf/concept/Article',
        kind: 'concept',
        displayName: 'Article',
        definingFile: 'article.concept',
      }, storage);

      const result = await symbolHandler.get({ symbol: 'symbol-1' }, storage);
      expect(result.variant).toBe('ok');
      expect(result.symbolString).toBe('copf/concept/Article');
      expect(result.kind).toBe('concept');
      expect(result.displayName).toBe('Article');
      expect(result.definingFile).toBe('article.concept');
      expect(result.visibility).toBe('public');
      expect(result.namespace).toBe('copf/concept');
    });

    it('returns notfound for missing symbol', async () => {
      const result = await symbolHandler.get({ symbol: 'nonexistent' }, storage);
      expect(result.variant).toBe('notfound');
    });
  });
});
