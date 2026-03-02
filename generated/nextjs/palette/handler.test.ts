// Palette — handler.test.ts
import { describe, it, expect } from 'vitest';
import * as TE from 'fp-ts/TaskEither';
import * as E from 'fp-ts/Either';
import { pipe } from 'fp-ts/function';

import { paletteHandler } from './handler.js';
import type { PaletteStorage } from './types.js';

const createTestStorage = (): PaletteStorage => {
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

const createFailingStorage = (): PaletteStorage => ({
  get: async () => { throw new Error('storage failure'); },
  put: async () => { throw new Error('storage failure'); },
  delete: async () => { throw new Error('storage failure'); },
  find: async () => { throw new Error('storage failure'); },
});

describe('Palette handler', () => {
  describe('generate', () => {
    it('should generate a 10-step color scale from a valid hex seed', async () => {
      const storage = createTestStorage();

      const result = await paletteHandler.generate(
        { palette: 'primary', name: 'Blue', seed: '#3366FF' },
        storage,
      )();

      expect(E.isRight(result)).toBe(true);
      if (E.isRight(result)) {
        expect(result.right.variant).toBe('ok');
        if (result.right.variant === 'ok') {
          const scale = JSON.parse(result.right.scale);
          expect(scale.length).toBe(10);
          expect(scale[0]).toMatch(/^#[0-9a-f]{6}$/);
        }
      }
    });

    it('should accept short hex (#RGB) notation', async () => {
      const storage = createTestStorage();

      const result = await paletteHandler.generate(
        { palette: 'accent', name: 'Red', seed: '#F00' },
        storage,
      )();

      expect(E.isRight(result)).toBe(true);
      if (E.isRight(result)) {
        expect(result.right.variant).toBe('ok');
      }
    });

    it('should return invalid for a bad hex color', async () => {
      const storage = createTestStorage();

      const result = await paletteHandler.generate(
        { palette: 'bad', name: 'Bad', seed: 'not-a-color' },
        storage,
      )();

      expect(E.isRight(result)).toBe(true);
      if (E.isRight(result)) {
        expect(result.right.variant).toBe('invalid');
      }
    });

    it('should persist the palette to storage', async () => {
      const storage = createTestStorage();

      await paletteHandler.generate(
        { palette: 'stored', name: 'Green', seed: '#00FF00' },
        storage,
      )();

      const stored = await storage.get('palette', 'stored');
      expect(stored).not.toBeNull();
      expect(stored!.name).toBe('Green');
    });

    it('should return left on storage failure', async () => {
      const storage = createFailingStorage();

      const result = await paletteHandler.generate(
        { palette: 'fail', name: 'Fail', seed: '#000000' },
        storage,
      )();

      expect(E.isLeft(result)).toBe(true);
    });
  });

  describe('assignRole', () => {
    it('should assign a role to an existing palette', async () => {
      const storage = createTestStorage();
      await paletteHandler.generate(
        { palette: 'p1', name: 'Blue', seed: '#0000FF' },
        storage,
      )();

      const result = await paletteHandler.assignRole(
        { palette: 'p1', role: 'primary' },
        storage,
      )();

      expect(E.isRight(result)).toBe(true);
      if (E.isRight(result)) {
        expect(result.right.variant).toBe('ok');
      }
    });

    it('should return notfound for nonexistent palette', async () => {
      const storage = createTestStorage();

      const result = await paletteHandler.assignRole(
        { palette: 'missing', role: 'error' },
        storage,
      )();

      expect(E.isRight(result)).toBe(true);
      if (E.isRight(result)) {
        expect(result.right.variant).toBe('notfound');
      }
    });
  });

  describe('checkContrast', () => {
    it('should compute contrast ratio for black on white (passes AAA)', async () => {
      const storage = createTestStorage();

      const result = await paletteHandler.checkContrast(
        { foreground: '#000000', background: '#FFFFFF' },
        storage,
      )();

      expect(E.isRight(result)).toBe(true);
      if (E.isRight(result) && result.right.variant === 'ok') {
        expect(result.right.ratio).toBeGreaterThanOrEqual(21);
        expect(result.right.passesAA).toBe(true);
        expect(result.right.passesAAA).toBe(true);
      }
    });

    it('should fail contrast check for similar colors', async () => {
      const storage = createTestStorage();

      const result = await paletteHandler.checkContrast(
        { foreground: '#CCCCCC', background: '#DDDDDD' },
        storage,
      )();

      expect(E.isRight(result)).toBe(true);
      if (E.isRight(result) && result.right.variant === 'ok') {
        expect(result.right.passesAA).toBe(false);
        expect(result.right.passesAAA).toBe(false);
      }
    });

    it('should return notfound for invalid foreground color', async () => {
      const storage = createTestStorage();

      const result = await paletteHandler.checkContrast(
        { foreground: 'invalid', background: '#FFFFFF' },
        storage,
      )();

      expect(E.isRight(result)).toBe(true);
      if (E.isRight(result)) {
        expect(result.right.variant).toBe('notfound');
      }
    });

    it('should return ok for background "bad" which parses as valid hex (#BAD)', async () => {
      const storage = createTestStorage();

      const result = await paletteHandler.checkContrast(
        { foreground: '#000000', background: 'bad' },
        storage,
      )();

      // "bad" without '#' is 3 chars long, so parseHex treats it as short hex (#BAD)
      // which expands to #BBAADD — a valid color. Handler returns 'ok'.
      expect(E.isRight(result)).toBe(true);
      if (E.isRight(result)) {
        expect(result.right.variant).toBe('ok');
      }
    });
  });
});
