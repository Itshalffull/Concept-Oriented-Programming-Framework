// Elevation — handler.test.ts
// Unit tests for elevation handler actions.

import { describe, it, expect } from 'vitest';
import * as TE from 'fp-ts/TaskEither';
import * as E from 'fp-ts/Either';
import { pipe } from 'fp-ts/function';

import { elevationHandler } from './handler.js';
import type { ElevationStorage } from './types.js';

const createTestStorage = (): ElevationStorage => {
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

const createFailingStorage = (): ElevationStorage => ({
  get: async () => { throw new Error('storage failure'); },
  put: async () => { throw new Error('storage failure'); },
  delete: async () => { throw new Error('storage failure'); },
  find: async () => { throw new Error('storage failure'); },
});

describe('Elevation handler', () => {
  describe('define', () => {
    it('should define a valid elevation level', async () => {
      const storage = createTestStorage();
      const result = await elevationHandler.define(
        { elevation: 'test-id-1', level: 2, shadow: '0 2px 4px rgba(0,0,0,0.1)' },
        storage,
      )();
      expect(E.isRight(result)).toBe(true);
      if (E.isRight(result)) {
        expect(result.right.variant).toBe('ok');
        if (result.right.variant === 'ok') {
          expect(result.right.elevation).toBe('test-id-1');
        }
      }
    });

    it('should return invalid for level out of range', async () => {
      const storage = createTestStorage();
      const result = await elevationHandler.define(
        { elevation: 'test-id-1', level: 25, shadow: 'some shadow' },
        storage,
      )();
      expect(E.isRight(result)).toBe(true);
      if (E.isRight(result)) {
        expect(result.right.variant).toBe('invalid');
      }
    });

    it('should return invalid for negative level', async () => {
      const storage = createTestStorage();
      const result = await elevationHandler.define(
        { elevation: 'test-id-1', level: -1, shadow: 'some shadow' },
        storage,
      )();
      expect(E.isRight(result)).toBe(true);
      if (E.isRight(result)) {
        expect(result.right.variant).toBe('invalid');
      }
    });

    it('should return invalid for empty shadow', async () => {
      const storage = createTestStorage();
      const result = await elevationHandler.define(
        { elevation: 'test-id-1', level: 1, shadow: '   ' },
        storage,
      )();
      expect(E.isRight(result)).toBe(true);
      if (E.isRight(result)) {
        expect(result.right.variant).toBe('invalid');
      }
    });

    it('should return left on storage failure for valid input', async () => {
      const storage = createFailingStorage();
      const result = await elevationHandler.define(
        { elevation: 'test-id-1', level: 1, shadow: '0 1px 2px' },
        storage,
      )();
      expect(E.isLeft(result)).toBe(true);
    });
  });

  describe('get', () => {
    it('should retrieve a defined elevation', async () => {
      const storage = createTestStorage();
      await elevationHandler.define(
        { elevation: 'test-id-1', level: 2, shadow: '0 2px 4px rgba(0,0,0,0.1)' },
        storage,
      )();
      const result = await elevationHandler.get(
        { elevation: 'test-id-1' },
        storage,
      )();
      expect(E.isRight(result)).toBe(true);
      if (E.isRight(result)) {
        expect(result.right.variant).toBe('ok');
        if (result.right.variant === 'ok') {
          expect(result.right.shadow).toBe('0 2px 4px rgba(0,0,0,0.1)');
        }
      }
    });

    it('should return notfound for nonexistent elevation', async () => {
      const storage = createTestStorage();
      const result = await elevationHandler.get(
        { elevation: 'missing' },
        storage,
      )();
      expect(E.isRight(result)).toBe(true);
      if (E.isRight(result)) {
        expect(result.right.variant).toBe('notfound');
      }
    });

    it('should return left on storage failure', async () => {
      const storage = createFailingStorage();
      const result = await elevationHandler.get(
        { elevation: 'test-id-1' },
        storage,
      )();
      expect(E.isLeft(result)).toBe(true);
    });
  });

  describe('generateScale', () => {
    it('should generate shadow scale from a valid hex color', async () => {
      const storage = createTestStorage();
      const result = await elevationHandler.generateScale(
        { baseColor: '#336699' },
        storage,
      )();
      expect(E.isRight(result)).toBe(true);
      if (E.isRight(result)) {
        expect(result.right.variant).toBe('ok');
        if (result.right.variant === 'ok') {
          const shadows = JSON.parse(result.right.shadows);
          expect(Array.isArray(shadows)).toBe(true);
          expect(shadows.length).toBeGreaterThan(0);
          expect(shadows[0]).toBe('none');
        }
      }
    });

    it('should generate shadow scale from short hex color', async () => {
      const storage = createTestStorage();
      const result = await elevationHandler.generateScale(
        { baseColor: '#369' },
        storage,
      )();
      expect(E.isRight(result)).toBe(true);
      if (E.isRight(result)) {
        expect(result.right.variant).toBe('ok');
      }
    });

    it('should return invalid for non-hex color', async () => {
      const storage = createTestStorage();
      const result = await elevationHandler.generateScale(
        { baseColor: 'not-a-color' },
        storage,
      )();
      expect(E.isRight(result)).toBe(true);
      if (E.isRight(result)) {
        expect(result.right.variant).toBe('invalid');
      }
    });

    it('should return left on storage failure for valid color', async () => {
      const storage = createFailingStorage();
      const result = await elevationHandler.generateScale(
        { baseColor: '#336699' },
        storage,
      )();
      expect(E.isLeft(result)).toBe(true);
    });
  });
});
