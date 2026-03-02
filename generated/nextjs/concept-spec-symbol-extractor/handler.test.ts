// ConceptSpecSymbolExtractor — handler.test.ts
// Unit tests for conceptSpecSymbolExtractor handler actions.

import { describe, it, expect } from 'vitest';
import * as TE from 'fp-ts/TaskEither';
import * as E from 'fp-ts/Either';
import { pipe } from 'fp-ts/function';

import { conceptSpecSymbolExtractorHandler } from './handler.js';
import type { ConceptSpecSymbolExtractorStorage } from './types.js';

const handler = conceptSpecSymbolExtractorHandler;

const createTestStorage = (): ConceptSpecSymbolExtractorStorage => {
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

const createFailingStorage = (): ConceptSpecSymbolExtractorStorage => ({
  get: async () => { throw new Error('storage failure'); },
  put: async () => { throw new Error('storage failure'); },
  delete: async () => { throw new Error('storage failure'); },
  find: async () => { throw new Error('storage failure'); },
});

describe('ConceptSpecSymbolExtractor handler', () => {
  describe('initialize', () => {
    it('should initialize and return an instance id', async () => {
      const storage = createTestStorage();
      const result = await handler.initialize({}, storage)();
      expect(E.isRight(result)).toBe(true);
      if (E.isRight(result)) {
        expect(result.right.variant).toBe('ok');
        if (result.right.variant === 'ok') {
          expect(result.right.instance).toContain('csse-');
        }
      }
    });

    it('should return loadError on storage failure', async () => {
      const storage = createFailingStorage();
      const result = await handler.initialize({}, storage)();
      expect(E.isRight(result)).toBe(true);
      if (E.isRight(result)) {
        expect(result.right.variant).toBe('loadError');
      }
    });
  });

  describe('extract', () => {
    it('should extract symbols from a JSON concept spec', async () => {
      const storage = createTestStorage();
      const content = JSON.stringify({
        name: 'Article',
        state: { title: { type: 'string' }, body: { type: 'string' } },
        actions: ['create', 'publish'],
        types: ['ArticleType'],
        events: ['onPublish'],
        invariants: ['titleNotEmpty'],
      });
      const result = await handler.extract(
        { file: 'article.concept', content },
        storage,
      )();
      expect(E.isRight(result)).toBe(true);
      if (E.isRight(result)) {
        const symbols = result.right.symbols;
        expect(symbols.length).toBeGreaterThan(0);
        const conceptSymbol = symbols.find((s) => s.kind === 'concept');
        expect(conceptSymbol).toBeDefined();
        expect(conceptSymbol!.name).toBe('Article');
      }
    });

    it('should extract symbols from line-based concept format', async () => {
      const storage = createTestStorage();
      const content = `concept Widget {
  label: String
  action render
}`;
      const result = await handler.extract(
        { file: 'widget.concept', content },
        storage,
      )();
      expect(E.isRight(result)).toBe(true);
      if (E.isRight(result)) {
        const symbols = result.right.symbols;
        const conceptSymbol = symbols.find((s) => s.kind === 'concept');
        expect(conceptSymbol).toBeDefined();
        expect(conceptSymbol!.name).toBe('Widget');
      }
    });

    it('should return Left on storage failure', async () => {
      const storage = createFailingStorage();
      const content = JSON.stringify({ name: 'Article' });
      const result = await handler.extract(
        { file: 'article.concept', content },
        storage,
      )();
      expect(E.isLeft(result)).toBe(true);
    });
  });

  describe('getSymbolsForFile', () => {
    it('should return symbols for a previously extracted file', async () => {
      const storage = createTestStorage();
      const content = JSON.stringify({ name: 'Article', actions: ['create'] });
      await handler.extract({ file: 'article.concept', content }, storage)();
      const result = await handler.getSymbolsForFile(
        { file: 'article.concept' },
        storage,
      )();
      expect(E.isRight(result)).toBe(true);
      if (E.isRight(result)) {
        expect(result.right.symbols.length).toBeGreaterThan(0);
      }
    });

    it('should return Left on storage failure', async () => {
      const storage = createFailingStorage();
      const result = await handler.getSymbolsForFile(
        { file: 'article.concept' },
        storage,
      )();
      expect(E.isLeft(result)).toBe(true);
    });
  });

  describe('findByName', () => {
    it('should find symbols matching a given name', async () => {
      const storage = createTestStorage();
      const content = JSON.stringify({ name: 'Article', actions: ['create'] });
      await handler.extract({ file: 'article.concept', content }, storage)();
      const result = await handler.findByName({ name: 'create' }, storage)();
      expect(E.isRight(result)).toBe(true);
      if (E.isRight(result)) {
        expect(result.right.symbols.length).toBeGreaterThan(0);
        expect(result.right.symbols[0].name).toBe('create');
      }
    });

    it('should return empty list when no match found', async () => {
      const storage = createTestStorage();
      const result = await handler.findByName({ name: 'nonexistent' }, storage)();
      expect(E.isRight(result)).toBe(true);
      if (E.isRight(result)) {
        expect(result.right.symbols.length).toBe(0);
      }
    });

    it('should return Left on storage failure', async () => {
      const storage = createFailingStorage();
      const result = await handler.findByName({ name: 'create' }, storage)();
      expect(E.isLeft(result)).toBe(true);
    });
  });
});
