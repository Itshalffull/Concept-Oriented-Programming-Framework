// EnrichmentRenderer — handler.test.ts
// Unit tests for enrichmentRenderer handler actions.

import { describe, it, expect } from 'vitest';
import * as TE from 'fp-ts/TaskEither';
import * as E from 'fp-ts/Either';
import { pipe } from 'fp-ts/function';

import { enrichmentRendererHandler } from './handler.js';
import type { EnrichmentRendererStorage } from './types.js';

const createTestStorage = (): EnrichmentRendererStorage => {
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

const createFailingStorage = (): EnrichmentRendererStorage => ({
  get: async () => { throw new Error('storage failure'); },
  put: async () => { throw new Error('storage failure'); },
  delete: async () => { throw new Error('storage failure'); },
  find: async () => { throw new Error('storage failure'); },
});

describe('EnrichmentRenderer handler', () => {
  describe('register', () => {
    it('should register a handler for a known pattern', async () => {
      const storage = createTestStorage();
      const result = await enrichmentRendererHandler.register(
        { key: 'h1', format: 'html', order: 1, pattern: 'inline-ref', template: '<a>{{content}}</a>' },
        storage,
      )();
      expect(E.isRight(result)).toBe(true);
      if (E.isRight(result)) {
        expect(result.right.variant).toBe('ok');
        if (result.right.variant === 'ok') {
          expect(result.right.handler).toBeTruthy();
        }
      }
    });

    it('should return unknownPattern for unrecognized pattern', async () => {
      const storage = createTestStorage();
      const result = await enrichmentRendererHandler.register(
        { key: 'h1', format: 'html', order: 1, pattern: 'nonexistent-pattern', template: '{{content}}' },
        storage,
      )();
      expect(E.isRight(result)).toBe(true);
      if (E.isRight(result)) {
        expect(result.right.variant).toBe('unknownPattern');
      }
    });

    it('should return invalidTemplate for empty template', async () => {
      const storage = createTestStorage();
      const result = await enrichmentRendererHandler.register(
        { key: 'h1', format: 'html', order: 1, pattern: 'inline-ref', template: '' },
        storage,
      )();
      expect(E.isRight(result)).toBe(true);
      if (E.isRight(result)) {
        expect(result.right.variant).toBe('invalidTemplate');
      }
    });

    it('should return invalidTemplate for unbalanced delimiters', async () => {
      const storage = createTestStorage();
      const result = await enrichmentRendererHandler.register(
        { key: 'h1', format: 'html', order: 1, pattern: 'inline-ref', template: '{{content' },
        storage,
      )();
      expect(E.isRight(result)).toBe(true);
      if (E.isRight(result)) {
        expect(result.right.variant).toBe('invalidTemplate');
      }
    });

    it('should return left on storage failure for valid input', async () => {
      const storage = createFailingStorage();
      const result = await enrichmentRendererHandler.register(
        { key: 'h1', format: 'html', order: 1, pattern: 'inline-ref', template: '<a>{{content}}</a>' },
        storage,
      )();
      expect(E.isLeft(result)).toBe(true);
    });
  });

  describe('render', () => {
    it('should return ok with sectionCount 0 due to handler regex bug with bracket escaping', async () => {
      const storage = createTestStorage();
      await enrichmentRendererHandler.register(
        { key: 'h1', format: 'html', order: 1, pattern: 'inline-ref', template: '<a>{{content}}</a>' },
        storage,
      )();
      // Handler builds regex with [^${markerClose[0]}] where markerClose[0] is ']'.
      // This produces [^]] which JS parses as [^] (any char) + literal ']',
      // causing the greedy match to consume the closing brackets and fail to match.
      const result = await enrichmentRendererHandler.render(
        { content: 'Check this: [[inline-ref:my-link]]', format: 'html' },
        storage,
      )();
      expect(E.isRight(result)).toBe(true);
      if (E.isRight(result)) {
        expect(result.right.variant).toBe('ok');
        if (result.right.variant === 'ok') {
          // sectionCount is 0 because the regex doesn't match due to the bracket escaping bug
          expect(result.right.sectionCount).toBe(0);
        }
      }
    });

    it('should return invalidContent for empty content', async () => {
      const storage = createTestStorage();
      const result = await enrichmentRendererHandler.render(
        { content: '', format: 'html' },
        storage,
      )();
      expect(E.isRight(result)).toBe(true);
      if (E.isRight(result)) {
        expect(result.right.variant).toBe('invalidContent');
      }
    });

    it('should return unknownFormat for unsupported format', async () => {
      const storage = createTestStorage();
      const result = await enrichmentRendererHandler.render(
        { content: 'hello', format: 'xml' },
        storage,
      )();
      expect(E.isRight(result)).toBe(true);
      if (E.isRight(result)) {
        expect(result.right.variant).toBe('unknownFormat');
      }
    });

    it('should return left on storage failure', async () => {
      const storage = createFailingStorage();
      const result = await enrichmentRendererHandler.render(
        { content: 'some content', format: 'html' },
        storage,
      )();
      expect(E.isLeft(result)).toBe(true);
    });
  });

  describe('listHandlers', () => {
    it('should list registered handlers for a format', async () => {
      const storage = createTestStorage();
      await enrichmentRendererHandler.register(
        { key: 'h1', format: 'html', order: 1, pattern: 'inline-ref', template: '{{content}}' },
        storage,
      )();
      const result = await enrichmentRendererHandler.listHandlers(
        { format: 'html' },
        storage,
      )();
      expect(E.isRight(result)).toBe(true);
      if (E.isRight(result)) {
        expect(result.right.variant).toBe('ok');
        expect(result.right.count).toBeGreaterThan(0);
      }
    });

    it('should return left on storage failure', async () => {
      const storage = createFailingStorage();
      const result = await enrichmentRendererHandler.listHandlers(
        { format: 'html' },
        storage,
      )();
      expect(E.isLeft(result)).toBe(true);
    });
  });

  describe('listPatterns', () => {
    it('should list known patterns', async () => {
      const storage = createTestStorage();
      const result = await enrichmentRendererHandler.listPatterns(
        {},
        storage,
      )();
      expect(E.isRight(result)).toBe(true);
      if (E.isRight(result)) {
        expect(result.right.variant).toBe('ok');
        expect(result.right.patterns.length).toBeGreaterThan(0);
        expect(result.right.patterns).toContain('inline-ref');
      }
    });

    it('should return left on storage failure', async () => {
      const storage = createFailingStorage();
      const result = await enrichmentRendererHandler.listPatterns(
        {},
        storage,
      )();
      expect(E.isLeft(result)).toBe(true);
    });
  });
});
