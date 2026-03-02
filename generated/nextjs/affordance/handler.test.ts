// Affordance — handler.test.ts
// Unit tests for affordance handler actions.

import { describe, it, expect } from 'vitest';
import * as TE from 'fp-ts/TaskEither';
import * as E from 'fp-ts/Either';
import * as O from 'fp-ts/Option';
import { pipe } from 'fp-ts/function';

import { affordanceHandler } from './handler.js';
import type { AffordanceStorage } from './types.js';

const createTestStorage = (): AffordanceStorage => {
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

const createFailingStorage = (): AffordanceStorage => ({
  get: async () => { throw new Error('storage failure'); },
  put: async () => { throw new Error('storage failure'); },
  delete: async () => { throw new Error('storage failure'); },
  find: async () => { throw new Error('storage failure'); },
});

describe('Affordance handler', () => {
  describe('declare', () => {
    it('declares successfully with valid input', async () => {
      const storage = createTestStorage();
      const result = await affordanceHandler.declare(
        { affordance: 'clickable', widget: 'button', interactor: 'mouse', specificity: 10, conditions: O.none },
        storage,
      )();
      expect(E.isRight(result)).toBe(true);
      if (E.isRight(result)) {
        expect(result.right.variant).toBe('ok');
        if (result.right.variant === 'ok') {
          expect(result.right.affordance).toBe('clickable');
        }
      }
    });

    it('returns duplicate when declaring same affordance twice', async () => {
      const storage = createTestStorage();
      await affordanceHandler.declare(
        { affordance: 'clickable', widget: 'button', interactor: 'mouse', specificity: 10, conditions: O.none },
        storage,
      )();
      const result = await affordanceHandler.declare(
        { affordance: 'clickable', widget: 'button', interactor: 'mouse', specificity: 10, conditions: O.none },
        storage,
      )();
      expect(E.isRight(result)).toBe(true);
      if (E.isRight(result)) {
        expect(result.right.variant).toBe('duplicate');
      }
    });

    it('propagates storage errors', async () => {
      const storage = createFailingStorage();
      const result = await affordanceHandler.declare(
        { affordance: 'clickable', widget: 'button', interactor: 'mouse', specificity: 10, conditions: O.none },
        storage,
      )();
      expect(E.isLeft(result)).toBe(true);
    });
  });

  describe('match', () => {
    it('returns none when no affordances match', async () => {
      const storage = createTestStorage();
      const result = await affordanceHandler.match(
        { affordance: 'clickable', interactor: 'mouse', context: '{}' },
        storage,
      )();
      expect(E.isRight(result)).toBe(true);
      if (E.isRight(result)) {
        expect(result.right.variant).toBe('none');
      }
    });

    it('returns ok with matches after declare', async () => {
      const storage = createTestStorage();
      await affordanceHandler.declare(
        { affordance: 'clickable', widget: 'button', interactor: 'mouse', specificity: 10, conditions: O.none },
        storage,
      )();
      const result = await affordanceHandler.match(
        { affordance: 'clickable', interactor: 'mouse', context: '{}' },
        storage,
      )();
      expect(E.isRight(result)).toBe(true);
      if (E.isRight(result)) {
        expect(result.right.variant).toBe('ok');
      }
    });

    it('propagates storage errors', async () => {
      const storage = createFailingStorage();
      const result = await affordanceHandler.match(
        { affordance: 'clickable', interactor: 'mouse', context: '{}' },
        storage,
      )();
      expect(E.isLeft(result)).toBe(true);
    });
  });

  describe('explain', () => {
    it('returns notfound for missing affordance', async () => {
      const storage = createTestStorage();
      const result = await affordanceHandler.explain(
        { affordance: 'nonexistent' },
        storage,
      )();
      expect(E.isRight(result)).toBe(true);
      if (E.isRight(result)) {
        expect(result.right.variant).toBe('notfound');
      }
    });

    it('returns ok after declare', async () => {
      const storage = createTestStorage();
      await affordanceHandler.declare(
        { affordance: 'draggable', widget: 'card', interactor: 'touch', specificity: 5, conditions: O.none },
        storage,
      )();
      const result = await affordanceHandler.explain(
        { affordance: 'draggable' },
        storage,
      )();
      expect(E.isRight(result)).toBe(true);
      if (E.isRight(result)) {
        expect(result.right.variant).toBe('ok');
        if (result.right.variant === 'ok') {
          expect(result.right.affordance).toBe('draggable');
          expect(result.right.reason).toContain('Widget: card');
        }
      }
    });

    it('propagates storage errors', async () => {
      const storage = createFailingStorage();
      const result = await affordanceHandler.explain(
        { affordance: 'test' },
        storage,
      )();
      expect(E.isLeft(result)).toBe(true);
    });
  });

  describe('remove', () => {
    it('returns notfound for missing affordance', async () => {
      const storage = createTestStorage();
      const result = await affordanceHandler.remove(
        { affordance: 'nonexistent' },
        storage,
      )();
      expect(E.isRight(result)).toBe(true);
      if (E.isRight(result)) {
        expect(result.right.variant).toBe('notfound');
      }
    });

    it('removes successfully after declare', async () => {
      const storage = createTestStorage();
      await affordanceHandler.declare(
        { affordance: 'editable', widget: 'input', interactor: 'keyboard', specificity: 1, conditions: O.none },
        storage,
      )();
      const result = await affordanceHandler.remove(
        { affordance: 'editable' },
        storage,
      )();
      expect(E.isRight(result)).toBe(true);
      if (E.isRight(result)) {
        expect(result.right.variant).toBe('ok');
        if (result.right.variant === 'ok') {
          expect(result.right.affordance).toBe('editable');
        }
      }
    });

    it('propagates storage errors', async () => {
      const storage = createFailingStorage();
      const result = await affordanceHandler.remove(
        { affordance: 'test' },
        storage,
      )();
      expect(E.isLeft(result)).toBe(true);
    });
  });
});
