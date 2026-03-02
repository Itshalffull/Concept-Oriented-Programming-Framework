// Annotation — handler.test.ts
// Unit tests for annotation handler actions.

import { describe, it, expect } from 'vitest';
import * as TE from 'fp-ts/TaskEither';
import * as E from 'fp-ts/Either';
import { pipe } from 'fp-ts/function';

import { annotationHandler } from './handler.js';
import type { AnnotationStorage } from './types.js';

const createTestStorage = (): AnnotationStorage => {
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

const createFailingStorage = (): AnnotationStorage => ({
  get: async () => { throw new Error('storage failure'); },
  put: async () => { throw new Error('storage failure'); },
  delete: async () => { throw new Error('storage failure'); },
  find: async () => { throw new Error('storage failure'); },
});

describe('Annotation handler', () => {
  describe('annotate', () => {
    it('annotates successfully with valid scope and JSON content', async () => {
      const storage = createTestStorage();
      const result = await annotationHandler.annotate(
        { concept: 'user', scope: 'concept', content: '{"gate":true}' },
        storage,
      )();
      expect(E.isRight(result)).toBe(true);
      if (E.isRight(result)) {
        expect(result.right.variant).toBe('ok');
        if (result.right.variant === 'ok') {
          expect(result.right.keyCount).toBe(1);
        }
      }
    });

    it('annotates with plain string content (non-JSON)', async () => {
      const storage = createTestStorage();
      const result = await annotationHandler.annotate(
        { concept: 'user', scope: 'field', content: 'plain text annotation' },
        storage,
      )();
      expect(E.isRight(result)).toBe(true);
      if (E.isRight(result)) {
        expect(result.right.variant).toBe('ok');
        if (result.right.variant === 'ok') {
          expect(result.right.keyCount).toBe(1);
        }
      }
    });

    it('returns invalidScope for unsupported scope', async () => {
      const storage = createTestStorage();
      const result = await annotationHandler.annotate(
        { concept: 'user', scope: 'invalid-scope', content: '{}' },
        storage,
      )();
      expect(E.isRight(result)).toBe(true);
      if (E.isRight(result)) {
        expect(result.right.variant).toBe('invalidScope');
      }
    });

    it('propagates storage errors', async () => {
      const storage = createFailingStorage();
      const result = await annotationHandler.annotate(
        { concept: 'user', scope: 'concept', content: '{}' },
        storage,
      )();
      expect(E.isLeft(result)).toBe(true);
    });
  });

  describe('resolve', () => {
    it('returns notFound for concept with no annotations', async () => {
      const storage = createTestStorage();
      const result = await annotationHandler.resolve(
        { concept: 'nonexistent' },
        storage,
      )();
      expect(E.isRight(result)).toBe(true);
      if (E.isRight(result)) {
        expect(result.right.variant).toBe('notFound');
      }
    });

    it('returns annotations after annotate', async () => {
      const storage = createTestStorage();
      await annotationHandler.annotate(
        { concept: 'user', scope: 'concept', content: '{"gate":true}' },
        storage,
      )();
      const result = await annotationHandler.resolve(
        { concept: 'user' },
        storage,
      )();
      expect(E.isRight(result)).toBe(true);
      if (E.isRight(result)) {
        expect(result.right.variant).toBe('ok');
        if (result.right.variant === 'ok') {
          expect(result.right.annotations.length).toBeGreaterThanOrEqual(1);
        }
      }
    });

    it('propagates storage errors', async () => {
      const storage = createFailingStorage();
      const result = await annotationHandler.resolve(
        { concept: 'user' },
        storage,
      )();
      expect(E.isLeft(result)).toBe(true);
    });
  });
});
