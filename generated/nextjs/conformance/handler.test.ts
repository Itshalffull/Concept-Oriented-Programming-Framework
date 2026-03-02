// Conformance — handler.test.ts
// Unit tests for conformance handler actions.

import { describe, it, expect } from 'vitest';
import * as TE from 'fp-ts/TaskEither';
import * as E from 'fp-ts/Either';
import * as O from 'fp-ts/Option';
import { pipe } from 'fp-ts/function';

import { conformanceHandler } from './handler.js';
import type { ConformanceStorage } from './types.js';

const handler = conformanceHandler;

const createTestStorage = (): ConformanceStorage => {
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

const createFailingStorage = (): ConformanceStorage => ({
  get: async () => { throw new Error('storage failure'); },
  put: async () => { throw new Error('storage failure'); },
  delete: async () => { throw new Error('storage failure'); },
  find: async () => { throw new Error('storage failure'); },
});

describe('Conformance handler', () => {
  describe('generate', () => {
    it('should generate a conformance test suite for a concept', async () => {
      const storage = createTestStorage();
      const result = await handler.generate(
        { concept: 'Article', specPath: 'article.concept' },
        storage,
      )();
      expect(E.isRight(result)).toBe(true);
      if (E.isRight(result)) {
        expect(result.right.variant).toBe('ok');
        if (result.right.variant === 'ok') {
          expect(result.right.suite).toBe('Article-conformance');
          expect(result.right.testVectors.length).toBeGreaterThan(0);
        }
      }
    });

    it('should return specError for empty spec path', async () => {
      const storage = createTestStorage();
      const result = await handler.generate(
        { concept: 'Article', specPath: '' },
        storage,
      )();
      expect(E.isRight(result)).toBe(true);
      if (E.isRight(result)) {
        expect(result.right.variant).toBe('specError');
      }
    });

    it('should return Left on storage failure', async () => {
      const storage = createFailingStorage();
      const result = await handler.generate(
        { concept: 'Article', specPath: 'article.concept' },
        storage,
      )();
      expect(E.isLeft(result)).toBe(true);
    });
  });

  describe('verify', () => {
    it('should verify a generated suite and return ok', async () => {
      const storage = createTestStorage();
      await handler.generate(
        { concept: 'Article', specPath: 'article.concept' },
        storage,
      )();
      const result = await handler.verify(
        { suite: 'Article-conformance', language: 'typescript', artifactLocation: '/dist' },
        storage,
      )();
      expect(E.isRight(result)).toBe(true);
      if (E.isRight(result)) {
        expect(result.right.variant).toBe('ok');
        if (result.right.variant === 'ok') {
          expect(result.right.passed).toBe(result.right.total);
        }
      }
    });

    it('should return failure when suite does not exist', async () => {
      const storage = createTestStorage();
      const result = await handler.verify(
        { suite: 'nonexistent', language: 'typescript', artifactLocation: '/dist' },
        storage,
      )();
      expect(E.isRight(result)).toBe(true);
      if (E.isRight(result)) {
        expect(result.right.variant).toBe('failure');
      }
    });

    it('should detect deviations when registered', async () => {
      const storage = createTestStorage();
      await handler.generate(
        { concept: 'Article', specPath: 'article.concept' },
        storage,
      )();
      await handler.registerDeviation(
        { concept: 'Article', language: 'rust', requirement: 'create', reason: 'lifetime constraint' },
        storage,
      )();
      const result = await handler.verify(
        { suite: 'Article-conformance', language: 'rust', artifactLocation: '/target' },
        storage,
      )();
      expect(E.isRight(result)).toBe(true);
      if (E.isRight(result)) {
        expect(result.right.variant).toBe('deviationDetected');
      }
    });

    it('should return Left on storage failure', async () => {
      const storage = createFailingStorage();
      const result = await handler.verify(
        { suite: 'Article-conformance', language: 'typescript', artifactLocation: '/dist' },
        storage,
      )();
      expect(E.isLeft(result)).toBe(true);
    });
  });

  describe('registerDeviation', () => {
    it('should register a deviation and return ok', async () => {
      const storage = createTestStorage();
      const result = await handler.registerDeviation(
        { concept: 'Article', language: 'rust', requirement: 'create', reason: 'test reason' },
        storage,
      )();
      expect(E.isRight(result)).toBe(true);
      if (E.isRight(result)) {
        expect(result.right.variant).toBe('ok');
        expect(result.right.suite).toBe('Article-conformance');
      }
    });

    it('should return Left on storage failure', async () => {
      const storage = createFailingStorage();
      const result = await handler.registerDeviation(
        { concept: 'Article', language: 'rust', requirement: 'create', reason: 'test' },
        storage,
      )();
      expect(E.isLeft(result)).toBe(true);
    });
  });

  describe('matrix', () => {
    it('should return a conformance matrix', async () => {
      const storage = createTestStorage();
      await handler.generate(
        { concept: 'Article', specPath: 'article.concept' },
        storage,
      )();
      const result = await handler.matrix(
        { concepts: O.none },
        storage,
      )();
      expect(E.isRight(result)).toBe(true);
      if (E.isRight(result)) {
        expect(result.right.variant).toBe('ok');
      }
    });

    it('should return Left on storage failure', async () => {
      const storage = createFailingStorage();
      const result = await handler.matrix(
        { concepts: O.none },
        storage,
      )();
      expect(E.isLeft(result)).toBe(true);
    });
  });

  describe('traceability', () => {
    it('should return traceability report for a concept', async () => {
      const storage = createTestStorage();
      await handler.generate(
        { concept: 'Article', specPath: 'article.concept' },
        storage,
      )();
      const result = await handler.traceability(
        { concept: 'Article' },
        storage,
      )();
      expect(E.isRight(result)).toBe(true);
      if (E.isRight(result)) {
        expect(result.right.variant).toBe('ok');
        expect(result.right.requirements.length).toBeGreaterThan(0);
      }
    });

    it('should return empty requirements when suite does not exist', async () => {
      const storage = createTestStorage();
      const result = await handler.traceability(
        { concept: 'Nonexistent' },
        storage,
      )();
      expect(E.isRight(result)).toBe(true);
      if (E.isRight(result)) {
        expect(result.right.variant).toBe('ok');
        expect(result.right.requirements.length).toBe(0);
      }
    });

    it('should return Left on storage failure', async () => {
      const storage = createFailingStorage();
      const result = await handler.traceability(
        { concept: 'Article' },
        storage,
      )();
      expect(E.isLeft(result)).toBe(true);
    });
  });
});
