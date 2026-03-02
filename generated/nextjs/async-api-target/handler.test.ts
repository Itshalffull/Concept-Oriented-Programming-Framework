// AsyncApiTarget — handler.test.ts
// Unit tests for asyncApiTarget handler actions.

import { describe, it, expect } from 'vitest';
import * as TE from 'fp-ts/TaskEither';
import * as E from 'fp-ts/Either';
import { pipe } from 'fp-ts/function';

import { asyncApiTargetHandler } from './handler.js';
import type { AsyncApiTargetStorage } from './types.js';

const createTestStorage = (): AsyncApiTargetStorage => {
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

const createFailingStorage = (): AsyncApiTargetStorage => ({
  get: async () => { throw new Error('storage failure'); },
  put: async () => { throw new Error('storage failure'); },
  delete: async () => { throw new Error('storage failure'); },
  find: async () => { throw new Error('storage failure'); },
});

describe('AsyncApiTarget handler', () => {
  describe('generate', () => {
    it('generates spec successfully with valid input', async () => {
      const storage = createTestStorage();
      const result = await asyncApiTargetHandler.generate(
        {
          projections: ['user.created', 'order.placed'],
          syncSpecs: ['user.sync', 'order.sync'],
          config: JSON.stringify({ title: 'My API', version: '2.0.0' }),
        },
        storage,
      )();
      expect(E.isRight(result)).toBe(true);
      if (E.isRight(result)) {
        expect(result.right.variant).toBe('ok');
        expect(result.right.spec).toBeTruthy();
        expect(result.right.content).toContain('asyncapi');
        expect(result.right.content).toContain('My API');
      }
    });

    it('uses default config when config is invalid JSON', async () => {
      const storage = createTestStorage();
      const result = await asyncApiTargetHandler.generate(
        {
          projections: ['event.created'],
          syncSpecs: ['event.sync'],
          config: 'not-json',
        },
        storage,
      )();
      expect(E.isRight(result)).toBe(true);
      if (E.isRight(result)) {
        expect(result.right.variant).toBe('ok');
        expect(result.right.content).toContain('Clef AsyncAPI');
      }
    });

    it('handles empty projections and syncSpecs', async () => {
      const storage = createTestStorage();
      const result = await asyncApiTargetHandler.generate(
        { projections: [], syncSpecs: [], config: '{}' },
        storage,
      )();
      expect(E.isRight(result)).toBe(true);
      if (E.isRight(result)) {
        expect(result.right.variant).toBe('ok');
        expect(result.right.content).toContain('asyncapi');
      }
    });

    it('propagates storage errors', async () => {
      const storage = createFailingStorage();
      const result = await asyncApiTargetHandler.generate(
        { projections: ['test'], syncSpecs: ['test.sync'], config: '{}' },
        storage,
      )();
      expect(E.isLeft(result)).toBe(true);
    });
  });
});
