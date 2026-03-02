// ConceptScaffoldGen — handler.test.ts
// Unit tests for conceptScaffoldGen handler actions.

import { describe, it, expect } from 'vitest';
import * as TE from 'fp-ts/TaskEither';
import * as E from 'fp-ts/Either';
import { pipe } from 'fp-ts/function';

import { conceptScaffoldGenHandler } from './handler.js';
import type { ConceptScaffoldGenStorage } from './types.js';

const handler = conceptScaffoldGenHandler;

const createTestStorage = (): ConceptScaffoldGenStorage => {
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

const createFailingStorage = (): ConceptScaffoldGenStorage => ({
  get: async () => { throw new Error('storage failure'); },
  put: async () => { throw new Error('storage failure'); },
  delete: async () => { throw new Error('storage failure'); },
  find: async () => { throw new Error('storage failure'); },
});

const validInput = {
  name: 'TestConcept',
  typeParam: 'T',
  purpose: 'A test concept',
  stateFields: [{ name: 'title', type: 'String' }] as readonly unknown[],
  actions: [{ name: 'create', inputs: [], outputs: [] }] as readonly unknown[],
};

describe('ConceptScaffoldGen handler', () => {
  describe('generate', () => {
    it('should generate concept scaffold files', async () => {
      const storage = createTestStorage();
      const result = await handler.generate(validInput, storage)();
      expect(E.isRight(result)).toBe(true);
      if (E.isRight(result)) {
        expect(result.right.variant).toBe('ok');
        if (result.right.variant === 'ok') {
          expect(result.right.filesGenerated).toBeGreaterThan(0);
          expect(result.right.files.length).toBe(result.right.filesGenerated);
        }
      }
    });

    it('should return Left for empty name', async () => {
      const storage = createTestStorage();
      const result = await handler.generate(
        { ...validInput, name: '  ' },
        storage,
      )();
      expect(E.isLeft(result)).toBe(true);
    });

    it('should return Left on storage failure', async () => {
      const storage = createFailingStorage();
      const result = await handler.generate(validInput, storage)();
      expect(E.isLeft(result)).toBe(true);
    });
  });

  describe('preview', () => {
    it('should preview files for a new concept', async () => {
      const storage = createTestStorage();
      const result = await handler.preview(validInput, storage)();
      expect(E.isRight(result)).toBe(true);
      if (E.isRight(result)) {
        expect(result.right.variant).toBe('ok');
        if (result.right.variant === 'ok') {
          expect(result.right.wouldWrite).toBeGreaterThan(0);
        }
      }
    });

    it('should return cached when concept was already generated', async () => {
      const storage = createTestStorage();
      await handler.generate(validInput, storage)();
      const result = await handler.preview(validInput, storage)();
      expect(E.isRight(result)).toBe(true);
      if (E.isRight(result)) {
        expect(result.right.variant).toBe('cached');
      }
    });

    it('should return Left on storage failure', async () => {
      const storage = createFailingStorage();
      const result = await handler.preview(validInput, storage)();
      expect(E.isLeft(result)).toBe(true);
    });
  });

  describe('register', () => {
    it('should return ok with handler metadata', async () => {
      const storage = createTestStorage();
      const result = await handler.register({}, storage)();
      expect(E.isRight(result)).toBe(true);
      if (E.isRight(result)) {
        expect(result.right.variant).toBe('ok');
        expect(result.right.name).toBe('concept-scaffold-gen');
        expect(result.right.capabilities).toContain('generate');
        expect(result.right.capabilities).toContain('preview');
      }
    });
  });
});
