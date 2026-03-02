// Typography — handler.test.ts
import { describe, it, expect } from 'vitest';
import * as TE from 'fp-ts/TaskEither';
import * as E from 'fp-ts/Either';
import { pipe } from 'fp-ts/function';

import { typographyHandler } from './handler.js';
import type { TypographyStorage } from './types.js';

const createTestStorage = (): TypographyStorage => {
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

const createFailingStorage = (): TypographyStorage => ({
  get: async () => { throw new Error('storage failure'); },
  put: async () => { throw new Error('storage failure'); },
  delete: async () => { throw new Error('storage failure'); },
  find: async () => { throw new Error('storage failure'); },
});

const handler = typographyHandler;

describe('Typography handler', () => {
  describe('defineScale', () => {
    it('should define a valid modular type scale', async () => {
      const storage = createTestStorage();
      const result = await handler.defineScale(
        { typography: 'main', baseSize: 16, ratio: 1.25, steps: 6 },
        storage,
      )();
      expect(E.isRight(result)).toBe(true);
      if (E.isRight(result)) {
        expect(result.right.variant).toBe('ok');
        if (result.right.variant === 'ok') {
          expect(result.right.typography).toBe('main');
          const scale = JSON.parse(result.right.scale);
          expect(Array.isArray(scale)).toBe(true);
          expect(scale.length).toBe(6);
          expect(scale[0]).toHaveProperty('step');
          expect(scale[0]).toHaveProperty('px');
          expect(scale[0]).toHaveProperty('rem');
          expect(scale[0]).toHaveProperty('lineHeight');
        }
      }
    });

    it('should return invalid when baseSize is zero or negative', async () => {
      const storage = createTestStorage();
      const result = await handler.defineScale(
        { typography: 'bad', baseSize: 0, ratio: 1.25, steps: 6 },
        storage,
      )();
      expect(E.isRight(result)).toBe(true);
      if (E.isRight(result)) {
        expect(result.right.variant).toBe('invalid');
      }
    });

    it('should return invalid when ratio is 1 or less', async () => {
      const storage = createTestStorage();
      const result = await handler.defineScale(
        { typography: 'bad', baseSize: 16, ratio: 1, steps: 6 },
        storage,
      )();
      expect(E.isRight(result)).toBe(true);
      if (E.isRight(result)) {
        expect(result.right.variant).toBe('invalid');
      }
    });

    it('should return invalid when steps is out of range', async () => {
      const storage = createTestStorage();
      const result = await handler.defineScale(
        { typography: 'bad', baseSize: 16, ratio: 1.25, steps: 1 },
        storage,
      )();
      expect(E.isRight(result)).toBe(true);
      if (E.isRight(result)) {
        expect(result.right.variant).toBe('invalid');
      }

      const result2 = await handler.defineScale(
        { typography: 'bad', baseSize: 16, ratio: 1.25, steps: 25 },
        storage,
      )();
      expect(E.isRight(result2)).toBe(true);
      if (E.isRight(result2)) {
        expect(result2.right.variant).toBe('invalid');
      }
    });

    it('should persist scale to storage', async () => {
      const storage = createTestStorage();
      await handler.defineScale(
        { typography: 'persist-test', baseSize: 16, ratio: 1.25, steps: 4 },
        storage,
      )();
      const stored = await storage.get('scale', 'persist-test');
      expect(stored).not.toBeNull();
      expect(stored!.typography).toBe('persist-test');
    });

    it('should return left on storage failure', async () => {
      const storage = createFailingStorage();
      const result = await handler.defineScale(
        { typography: 'fail', baseSize: 16, ratio: 1.25, steps: 6 },
        storage,
      )();
      expect(E.isLeft(result)).toBe(true);
      if (E.isLeft(result)) {
        expect(result.left.code).toBe('STORAGE_ERROR');
      }
    });
  });

  describe('defineFontStack', () => {
    it('should define a valid font stack', async () => {
      const storage = createTestStorage();
      const result = await handler.defineFontStack(
        { typography: 'main', name: 'heading', fonts: 'Inter, Arial, sans-serif', category: 'sans-serif' },
        storage,
      )();
      expect(E.isRight(result)).toBe(true);
      if (E.isRight(result)) {
        expect(result.right.variant).toBe('ok');
        if (result.right.variant === 'ok') {
          expect(result.right.typography).toBe('main');
        }
      }
    });

    it('should return duplicate when font stack already exists', async () => {
      const storage = createTestStorage();
      await handler.defineFontStack(
        { typography: 'main', name: 'body', fonts: 'Georgia, serif', category: 'serif' },
        storage,
      )();
      const result = await handler.defineFontStack(
        { typography: 'main', name: 'body', fonts: 'Times, serif', category: 'serif' },
        storage,
      )();
      expect(E.isRight(result)).toBe(true);
      if (E.isRight(result)) {
        expect(result.right.variant).toBe('duplicate');
      }
    });

    it('should return duplicate variant on invalid category', async () => {
      const storage = createTestStorage();
      const result = await handler.defineFontStack(
        { typography: 'main', name: 'bad', fonts: 'Arial', category: 'fantasy' },
        storage,
      )();
      expect(E.isRight(result)).toBe(true);
      if (E.isRight(result)) {
        expect(result.right.variant).toBe('duplicate');
      }
    });

    it('should return duplicate variant on empty fonts list', async () => {
      const storage = createTestStorage();
      const result = await handler.defineFontStack(
        { typography: 'main', name: 'empty', fonts: '  ,  , ', category: 'serif' },
        storage,
      )();
      expect(E.isRight(result)).toBe(true);
      if (E.isRight(result)) {
        expect(result.right.variant).toBe('duplicate');
      }
    });

    it('should return left on storage failure', async () => {
      const storage = createFailingStorage();
      const result = await handler.defineFontStack(
        { typography: 'main', name: 'fail', fonts: 'Arial', category: 'sans-serif' },
        storage,
      )();
      expect(E.isLeft(result)).toBe(true);
    });
  });

  describe('defineStyle', () => {
    it('should define a valid text style with scaleStep', async () => {
      const storage = createTestStorage();
      const result = await handler.defineStyle(
        { typography: 'main', name: 'h1', config: JSON.stringify({ scaleStep: 3, fontWeight: 700 }) },
        storage,
      )();
      expect(E.isRight(result)).toBe(true);
      if (E.isRight(result)) {
        expect(result.right.variant).toBe('ok');
      }
    });

    it('should define a valid text style with fontSize', async () => {
      const storage = createTestStorage();
      const result = await handler.defineStyle(
        { typography: 'main', name: 'body', config: JSON.stringify({ fontSize: 16 }) },
        storage,
      )();
      expect(E.isRight(result)).toBe(true);
      if (E.isRight(result)) {
        expect(result.right.variant).toBe('ok');
      }
    });

    it('should return invalid when config has neither scaleStep nor fontSize', async () => {
      const storage = createTestStorage();
      const result = await handler.defineStyle(
        { typography: 'main', name: 'bad', config: JSON.stringify({ fontWeight: 400 }) },
        storage,
      )();
      expect(E.isRight(result)).toBe(true);
      if (E.isRight(result)) {
        expect(result.right.variant).toBe('invalid');
      }
    });

    it('should return invalid when config is not an object', async () => {
      const storage = createTestStorage();
      const result = await handler.defineStyle(
        { typography: 'main', name: 'bad', config: JSON.stringify([1, 2, 3]) },
        storage,
      )();
      expect(E.isRight(result)).toBe(true);
      if (E.isRight(result)) {
        expect(result.right.variant).toBe('invalid');
      }
    });

    it('should return left on malformed JSON config', async () => {
      const storage = createTestStorage();
      const result = await handler.defineStyle(
        { typography: 'main', name: 'bad', config: '{{invalid json' },
        storage,
      )();
      expect(E.isLeft(result)).toBe(true);
      if (E.isLeft(result)) {
        expect(result.left.code).toBe('PARSE_ERROR');
      }
    });
  });
});
