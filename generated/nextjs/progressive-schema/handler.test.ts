// ProgressiveSchema — handler.test.ts
import { describe, it, expect } from 'vitest';
import * as TE from 'fp-ts/TaskEither';
import * as E from 'fp-ts/Either';
import { pipe } from 'fp-ts/function';

import { progressiveSchemaHandler } from './handler.js';
import type { ProgressiveSchemaStorage } from './types.js';

const createTestStorage = (): ProgressiveSchemaStorage => {
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

const createFailingStorage = (): ProgressiveSchemaStorage => ({
  get: async () => { throw new Error('storage failure'); },
  put: async () => { throw new Error('storage failure'); },
  delete: async () => { throw new Error('storage failure'); },
  find: async () => { throw new Error('storage failure'); },
});

const handler = progressiveSchemaHandler;

describe('ProgressiveSchema handler', () => {
  describe('captureFreeform', () => {
    it('should store freeform content and return ok with an item id', async () => {
      const storage = createTestStorage();
      const result = await handler.captureFreeform(
        { content: 'Meeting on 2024-01-15 with @alice about #project' },
        storage,
      )();
      expect(E.isRight(result)).toBe(true);
      if (E.isRight(result)) {
        expect(result.right.variant).toBe('ok');
        expect(result.right.itemId).toBeDefined();
        expect(result.right.itemId.startsWith('ps-')).toBe(true);
      }
    });

    it('should return left on storage failure', async () => {
      const storage = createFailingStorage();
      const result = await handler.captureFreeform(
        { content: 'test content' },
        storage,
      )();
      expect(E.isLeft(result)).toBe(true);
    });
  });

  describe('detectStructure', () => {
    it('should return notfound for unknown item', async () => {
      const storage = createTestStorage();
      const result = await handler.detectStructure(
        { itemId: 'nonexistent' },
        storage,
      )();
      expect(E.isRight(result)).toBe(true);
      if (E.isRight(result)) {
        expect(result.right.variant).toBe('notfound');
      }
    });

    it('should detect dates in content', async () => {
      const storage = createTestStorage();
      // First capture freeform content with a date
      const captureResult = await handler.captureFreeform(
        { content: 'Due by 2024-03-15 please' },
        storage,
      )();
      expect(E.isRight(captureResult)).toBe(true);
      if (!E.isRight(captureResult)) return;
      const itemId = captureResult.right.itemId;

      const result = await handler.detectStructure({ itemId }, storage)();
      expect(E.isRight(result)).toBe(true);
      if (E.isRight(result)) {
        expect(result.right.variant).toBe('ok');
        if (result.right.variant === 'ok') {
          const suggestions = JSON.parse(result.right.suggestions);
          expect(suggestions.length).toBeGreaterThan(0);
          const dateSugg = suggestions.find((s: Record<string, unknown>) => s.field === 'date');
          expect(dateSugg).toBeDefined();
          expect(dateSugg.value).toBe('2024-03-15');
        }
      }
    });

    it('should detect hashtags in content', async () => {
      const storage = createTestStorage();
      const captureResult = await handler.captureFreeform(
        { content: 'Working on #feature-x and #bug-fix' },
        storage,
      )();
      expect(E.isRight(captureResult)).toBe(true);
      if (!E.isRight(captureResult)) return;
      const itemId = captureResult.right.itemId;

      const result = await handler.detectStructure({ itemId }, storage)();
      expect(E.isRight(result)).toBe(true);
      if (E.isRight(result) && result.right.variant === 'ok') {
        const suggestions = JSON.parse(result.right.suggestions);
        const tags = suggestions.filter((s: Record<string, unknown>) => s.field === 'tag');
        expect(tags.length).toBe(2);
      }
    });

    it('should detect emails in content', async () => {
      const storage = createTestStorage();
      const captureResult = await handler.captureFreeform(
        { content: 'Contact alice@example.com for details' },
        storage,
      )();
      expect(E.isRight(captureResult)).toBe(true);
      if (!E.isRight(captureResult)) return;

      const result = await handler.detectStructure(
        { itemId: captureResult.right.itemId },
        storage,
      )();
      expect(E.isRight(result)).toBe(true);
      if (E.isRight(result) && result.right.variant === 'ok') {
        const suggestions = JSON.parse(result.right.suggestions);
        const emails = suggestions.filter((s: Record<string, unknown>) => s.field === 'email');
        expect(emails.length).toBe(1);
      }
    });
  });

  describe('acceptSuggestion', () => {
    it('should return notfound for unknown item', async () => {
      const storage = createTestStorage();
      const result = await handler.acceptSuggestion(
        { itemId: 'nonexistent', suggestionId: 'sug-1' },
        storage,
      )();
      expect(E.isRight(result)).toBe(true);
      if (E.isRight(result)) {
        expect(result.right.variant).toBe('notfound');
      }
    });

    it('should return notfound for unknown suggestion id', async () => {
      const storage = createTestStorage();
      const captureResult = await handler.captureFreeform(
        { content: 'plain text' },
        storage,
      )();
      expect(E.isRight(captureResult)).toBe(true);
      if (!E.isRight(captureResult)) return;

      const result = await handler.acceptSuggestion(
        { itemId: captureResult.right.itemId, suggestionId: 'nonexistent' },
        storage,
      )();
      expect(E.isRight(result)).toBe(true);
      if (E.isRight(result)) {
        expect(result.right.variant).toBe('notfound');
      }
    });
  });

  describe('rejectSuggestion', () => {
    it('should return notfound for unknown item', async () => {
      const storage = createTestStorage();
      const result = await handler.rejectSuggestion(
        { itemId: 'nonexistent', suggestionId: 'sug-1' },
        storage,
      )();
      expect(E.isRight(result)).toBe(true);
      if (E.isRight(result)) {
        expect(result.right.variant).toBe('notfound');
      }
    });
  });

  describe('promote', () => {
    it('should return notfound for unknown item', async () => {
      const storage = createTestStorage();
      const result = await handler.promote(
        { itemId: 'nonexistent', targetSchema: 'article' },
        storage,
      )();
      expect(E.isRight(result)).toBe(true);
      if (E.isRight(result)) {
        expect(result.right.variant).toBe('notfound');
      }
    });

    it('should return incomplete when required fields are missing', async () => {
      const storage = createTestStorage();
      const captureResult = await handler.captureFreeform(
        { content: 'some data' },
        storage,
      )();
      expect(E.isRight(captureResult)).toBe(true);
      if (!E.isRight(captureResult)) return;

      // Create a schema with required fields
      await storage.put('schemas', 'article', {
        name: 'article',
        required: JSON.stringify(['title', 'author']),
      });

      const result = await handler.promote(
        { itemId: captureResult.right.itemId, targetSchema: 'article' },
        storage,
      )();
      expect(E.isRight(result)).toBe(true);
      if (E.isRight(result)) {
        expect(result.right.variant).toBe('incomplete');
      }
    });

    it('should promote successfully when no required fields in schema', async () => {
      const storage = createTestStorage();
      const captureResult = await handler.captureFreeform(
        { content: 'some data' },
        storage,
      )();
      expect(E.isRight(captureResult)).toBe(true);
      if (!E.isRight(captureResult)) return;

      const result = await handler.promote(
        { itemId: captureResult.right.itemId, targetSchema: 'freeform' },
        storage,
      )();
      expect(E.isRight(result)).toBe(true);
      if (E.isRight(result)) {
        expect(result.right.variant).toBe('ok');
      }
    });
  });

  describe('inferSchema', () => {
    it('should return error for invalid JSON input', async () => {
      const storage = createTestStorage();
      const result = await handler.inferSchema(
        { items: 'not-json' },
        storage,
      )();
      expect(E.isRight(result)).toBe(true);
      if (E.isRight(result)) {
        expect(result.right.variant).toBe('error');
      }
    });

    it('should return error for fewer than 2 items', async () => {
      const storage = createTestStorage();
      const result = await handler.inferSchema(
        { items: JSON.stringify(['item1']) },
        storage,
      )();
      expect(E.isRight(result)).toBe(true);
      if (E.isRight(result)) {
        expect(result.right.variant).toBe('error');
      }
    });

    it('should infer a schema from multiple items with properties', async () => {
      const storage = createTestStorage();
      // Seed two items with overlapping properties
      await storage.put('items', 'i1', { properties: JSON.stringify({ title: 'A', author: 'Bob' }) });
      await storage.put('items', 'i2', { properties: JSON.stringify({ title: 'B', author: 'Alice' }) });

      const result = await handler.inferSchema(
        { items: JSON.stringify(['i1', 'i2']) },
        storage,
      )();
      expect(E.isRight(result)).toBe(true);
      if (E.isRight(result)) {
        expect(result.right.variant).toBe('ok');
        if (result.right.variant === 'ok') {
          const schema = JSON.parse(result.right.proposedSchema);
          expect(schema.fields).toBeDefined();
          expect(schema.sampleSize).toBe(2);
        }
      }
    });
  });
});
