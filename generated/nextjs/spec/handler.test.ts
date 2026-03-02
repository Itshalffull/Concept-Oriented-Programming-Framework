// Spec — handler.test.ts
import { describe, it, expect } from 'vitest';
import * as TE from 'fp-ts/TaskEither';
import * as E from 'fp-ts/Either';
import { pipe } from 'fp-ts/function';

import { specHandler } from './handler.js';
import type { SpecStorage } from './types.js';

const createTestStorage = (): SpecStorage => {
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

const createFailingStorage = (): SpecStorage => ({
  get: async () => { throw new Error('storage failure'); },
  put: async () => { throw new Error('storage failure'); },
  delete: async () => { throw new Error('storage failure'); },
  find: async () => { throw new Error('storage failure'); },
});

const handler = specHandler;

describe('Spec handler', () => {
  describe('emit', () => {
    it('should emit a JSON document from projections', async () => {
      const storage = createTestStorage();
      await storage.put('projections', 'session', {
        concept: 'session',
        actions: ['create', 'validate'],
      });
      const result = await handler.emit(
        { projections: ['session'], format: 'json', config: '{}' },
        storage,
      )();
      expect(E.isRight(result)).toBe(true);
      if (E.isRight(result)) {
        expect(result.right.variant).toBe('ok');
        if (result.right.variant === 'ok') {
          expect(result.right.content).toContain('session');
          const parsed = JSON.parse(result.right.content);
          expect(Array.isArray(parsed)).toBe(true);
        }
      }
    });

    it('should emit a yaml document from projections', async () => {
      const storage = createTestStorage();
      await storage.put('projections', 'auth', {
        concept: 'auth',
        actions: ['login'],
      });
      const result = await handler.emit(
        { projections: ['auth'], format: 'yaml', config: '{}' },
        storage,
      )();
      expect(E.isRight(result)).toBe(true);
      if (E.isRight(result)) {
        expect(result.right.variant).toBe('ok');
        if (result.right.variant === 'ok') {
          expect(result.right.content).toContain('concept: auth');
        }
      }
    });

    it('should return formatError for unsupported format', async () => {
      const storage = createTestStorage();
      const result = await handler.emit(
        { projections: ['test'], format: 'xml', config: '{}' },
        storage,
      )();
      expect(E.isRight(result)).toBe(true);
      if (E.isRight(result)) {
        expect(result.right.variant).toBe('formatError');
        if (result.right.variant === 'formatError') {
          expect(result.right.format).toBe('xml');
        }
      }
    });

    it('should emit empty document when no projections found', async () => {
      const storage = createTestStorage();
      const result = await handler.emit(
        { projections: ['nonexistent'], format: 'json', config: '{}' },
        storage,
      )();
      expect(E.isRight(result)).toBe(true);
      if (E.isRight(result)) {
        expect(result.right.variant).toBe('ok');
        if (result.right.variant === 'ok') {
          const parsed = JSON.parse(result.right.content);
          expect(parsed).toEqual([]);
        }
      }
    });

    it('should persist the emitted document for later validation', async () => {
      const storage = createTestStorage();
      const result = await handler.emit(
        { projections: ['p1'], format: 'json', config: '{}' },
        storage,
      )();
      expect(E.isRight(result)).toBe(true);
      if (E.isRight(result) && result.right.variant === 'ok') {
        const record = await storage.get('documents', result.right.document);
        expect(record).not.toBeNull();
        expect(record!['format']).toBe('json');
      }
    });

    it('should return left on storage failure', async () => {
      const storage = createFailingStorage();
      const result = await handler.emit(
        { projections: ['test'], format: 'json', config: '{}' },
        storage,
      )();
      expect(E.isLeft(result)).toBe(true);
    });
  });

  describe('validate', () => {
    it('should validate a well-formed document', async () => {
      const storage = createTestStorage();
      await storage.put('documents', 'valid-doc', {
        concept: 'session',
        actions: ['create', 'validate'],
      });
      const result = await handler.validate({ document: 'valid-doc' }, storage)();
      expect(E.isRight(result)).toBe(true);
      if (E.isRight(result)) {
        expect(result.right.variant).toBe('ok');
        if (result.right.variant === 'ok') {
          expect(result.right.document).toBe('valid-doc');
        }
      }
    });

    it('should return invalid for document missing required fields', async () => {
      const storage = createTestStorage();
      await storage.put('documents', 'bad-doc', {
        format: 'json',
      });
      const result = await handler.validate({ document: 'bad-doc' }, storage)();
      expect(E.isRight(result)).toBe(true);
      if (E.isRight(result)) {
        expect(result.right.variant).toBe('invalid');
        if (result.right.variant === 'invalid') {
          expect(result.right.errors.length).toBeGreaterThan(0);
          expect(result.right.errors.some(e => e.includes('concept'))).toBe(true);
        }
      }
    });

    it('should return invalid for nonexistent document', async () => {
      const storage = createTestStorage();
      const result = await handler.validate({ document: 'missing-doc' }, storage)();
      expect(E.isRight(result)).toBe(true);
      if (E.isRight(result)) {
        expect(result.right.variant).toBe('invalid');
        if (result.right.variant === 'invalid') {
          expect(result.right.errors[0]).toContain('not found');
        }
      }
    });

    it('should return invalid when actions is not an array', async () => {
      const storage = createTestStorage();
      await storage.put('documents', 'bad-actions', {
        concept: 'test',
        actions: 'not-an-array',
      });
      const result = await handler.validate({ document: 'bad-actions' }, storage)();
      expect(E.isRight(result)).toBe(true);
      if (E.isRight(result)) {
        expect(result.right.variant).toBe('invalid');
      }
    });
  });
});
