// CoifThemeScaffoldGen — handler.test.ts
// Unit tests for coifThemeScaffoldGen handler actions.

import { describe, it, expect } from 'vitest';
import * as TE from 'fp-ts/TaskEither';
import * as E from 'fp-ts/Either';
import { pipe } from 'fp-ts/function';

import { coifThemeScaffoldGenHandler } from './handler.js';
import type { CoifThemeScaffoldGenStorage } from './types.js';

const handler = coifThemeScaffoldGenHandler;

const createTestStorage = (): CoifThemeScaffoldGenStorage => {
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

const createFailingStorage = (): CoifThemeScaffoldGenStorage => ({
  get: async () => { throw new Error('storage failure'); },
  put: async () => { throw new Error('storage failure'); },
  delete: async () => { throw new Error('storage failure'); },
  find: async () => { throw new Error('storage failure'); },
});

const validInput = {
  name: 'ocean-theme',
  primaryColor: '#3b82f6',
  fontFamily: 'Inter',
  baseSize: 16,
  mode: 'light' as const,
};

describe('CoifThemeScaffoldGen handler', () => {
  describe('generate', () => {
    it('should generate theme scaffold files for valid input', async () => {
      const storage = createTestStorage();
      const result = await handler.generate(validInput, storage)();
      expect(E.isRight(result)).toBe(true);
      if (E.isRight(result)) {
        expect(result.right.variant).toBe('ok');
        if (result.right.variant === 'ok') {
          expect(result.right.filesGenerated).toBe(6);
          expect(result.right.files.length).toBe(6);
        }
      }
    });

    it('should return error for empty theme name', async () => {
      const storage = createTestStorage();
      const result = await handler.generate(
        { ...validInput, name: '  ' },
        storage,
      )();
      expect(E.isRight(result)).toBe(true);
      if (E.isRight(result)) {
        expect(result.right.variant).toBe('error');
      }
    });

    it('should return error for invalid hex color', async () => {
      const storage = createTestStorage();
      const result = await handler.generate(
        { ...validInput, primaryColor: 'not-a-color' },
        storage,
      )();
      expect(E.isRight(result)).toBe(true);
      if (E.isRight(result)) {
        expect(result.right.variant).toBe('error');
      }
    });

    it('should return error for invalid mode', async () => {
      const storage = createTestStorage();
      const result = await handler.generate(
        { ...validInput, mode: 'invalid' },
        storage,
      )();
      expect(E.isRight(result)).toBe(true);
      if (E.isRight(result)) {
        expect(result.right.variant).toBe('error');
      }
    });

    it('should return error for invalid base size', async () => {
      const storage = createTestStorage();
      const result = await handler.generate(
        { ...validInput, baseSize: 0 },
        storage,
      )();
      expect(E.isRight(result)).toBe(true);
      if (E.isRight(result)) {
        expect(result.right.variant).toBe('error');
      }
    });

    it('should return Left on storage failure', async () => {
      const storage = createFailingStorage();
      const result = await handler.generate(validInput, storage)();
      expect(E.isLeft(result)).toBe(true);
    });
  });

  describe('preview', () => {
    it('should preview files for a new theme', async () => {
      const storage = createTestStorage();
      const result = await handler.preview(validInput, storage)();
      expect(E.isRight(result)).toBe(true);
      if (E.isRight(result)) {
        expect(result.right.variant).toBe('ok');
        if (result.right.variant === 'ok') {
          expect(result.right.wouldWrite).toBe(6);
          expect(result.right.wouldSkip).toBe(0);
        }
      }
    });

    it('should return cached when scaffold was already generated with same files', async () => {
      const storage = createTestStorage();
      await handler.generate(validInput, storage)();
      const result = await handler.preview(validInput, storage)();
      expect(E.isRight(result)).toBe(true);
      if (E.isRight(result)) {
        expect(result.right.variant).toBe('cached');
      }
    });

    it('should return error variant for empty name', async () => {
      const storage = createTestStorage();
      const result = await handler.preview(
        { ...validInput, name: '' },
        storage,
      )();
      expect(E.isRight(result)).toBe(true);
      if (E.isRight(result)) {
        expect(result.right.variant).toBe('error');
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
        expect(result.right.name).toBe('coif-theme-scaffold-gen');
        expect(result.right.capabilities).toContain('palette');
        expect(result.right.capabilities).toContain('typography');
      }
    });
  });
});
