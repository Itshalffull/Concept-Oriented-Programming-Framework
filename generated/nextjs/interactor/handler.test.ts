// Interactor — handler.test.ts
// Unit tests for interactor handler actions.

import { describe, it, expect } from 'vitest';
import * as TE from 'fp-ts/TaskEither';
import * as E from 'fp-ts/Either';
import * as O from 'fp-ts/Option';
import { pipe } from 'fp-ts/function';

import { interactorHandler } from './handler.js';
import type { InteractorStorage } from './types.js';

const createTestStorage = (): InteractorStorage => {
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

const createFailingStorage = (): InteractorStorage => ({
  get: async () => { throw new Error('storage failure'); },
  put: async () => { throw new Error('storage failure'); },
  delete: async () => { throw new Error('storage failure'); },
  find: async () => { throw new Error('storage failure'); },
});

describe('Interactor handler', () => {
  describe('define', () => {
    it('should define a new interactor', async () => {
      const storage = createTestStorage();
      const input = {
        interactor: 'text-input',
        name: 'TextInput',
        category: 'input',
        properties: JSON.stringify({ supportedTypes: 'string' }),
      };

      const result = await interactorHandler.define(input, storage)();
      expect(E.isRight(result)).toBe(true);
      if (E.isRight(result)) {
        expect(result.right.variant).toBe('ok');
        if (result.right.variant === 'ok') {
          expect(result.right.interactor).toBe('text-input');
        }
      }
    });

    it('should return duplicate for already defined interactor', async () => {
      const storage = createTestStorage();
      const input = {
        interactor: 'dup-ia',
        name: 'Dup',
        category: 'input',
        properties: '{}',
      };

      await interactorHandler.define(input, storage)();
      const result = await interactorHandler.define(input, storage)();
      expect(E.isRight(result)).toBe(true);
      if (E.isRight(result)) {
        expect(result.right.variant).toBe('duplicate');
      }
    });

    it('should return left on storage failure', async () => {
      const storage = createFailingStorage();
      const input = { interactor: 'x', name: 'X', category: 'input', properties: '{}' };
      const result = await interactorHandler.define(input, storage)();
      expect(E.isLeft(result)).toBe(true);
    });
  });

  describe('classify', () => {
    it('should fall back to default mapping for unknown field type', async () => {
      const storage = createTestStorage();
      const input = {
        interactor: 'auto',
        fieldType: 'boolean',
        constraints: O.none,
        intent: O.none,
      };

      const result = await interactorHandler.classify(input, storage)();
      expect(E.isRight(result)).toBe(true);
      if (E.isRight(result)) {
        expect(result.right.variant).toBe('ok');
        if (result.right.variant === 'ok') {
          expect(result.right.interactor).toBe('checkbox');
        }
      }
    });

    it('should fall back to text-input for completely unknown type', async () => {
      const storage = createTestStorage();
      const input = {
        interactor: 'auto',
        fieldType: 'exotic-type',
        constraints: O.none,
        intent: O.none,
      };

      const result = await interactorHandler.classify(input, storage)();
      expect(E.isRight(result)).toBe(true);
      if (E.isRight(result)) {
        expect(result.right.variant).toBe('ok');
        if (result.right.variant === 'ok') {
          expect(result.right.interactor).toBe('text-input');
        }
      }
    });

    it('should return left on storage failure', async () => {
      const storage = createFailingStorage();
      const input = {
        interactor: 'x', fieldType: 'string',
        constraints: O.none, intent: O.none,
      };
      const result = await interactorHandler.classify(input, storage)();
      expect(E.isLeft(result)).toBe(true);
    });
  });

  describe('get', () => {
    it('should retrieve an existing interactor', async () => {
      const storage = createTestStorage();
      await interactorHandler.define({
        interactor: 'slider',
        name: 'Slider',
        category: 'input',
        properties: JSON.stringify({ min: 0, max: 100 }),
      }, storage)();

      const result = await interactorHandler.get({ interactor: 'slider' }, storage)();
      expect(E.isRight(result)).toBe(true);
      if (E.isRight(result)) {
        expect(result.right.variant).toBe('ok');
        if (result.right.variant === 'ok') {
          expect(result.right.name).toBe('Slider');
          expect(result.right.category).toBe('input');
        }
      }
    });

    it('should return notfound for missing interactor', async () => {
      const storage = createTestStorage();
      const result = await interactorHandler.get({ interactor: 'missing' }, storage)();
      expect(E.isRight(result)).toBe(true);
      if (E.isRight(result)) {
        expect(result.right.variant).toBe('notfound');
      }
    });

    it('should return left on storage failure', async () => {
      const storage = createFailingStorage();
      const result = await interactorHandler.get({ interactor: 'x' }, storage)();
      expect(E.isLeft(result)).toBe(true);
    });
  });

  describe('list', () => {
    it('should list all interactors', async () => {
      const storage = createTestStorage();
      await interactorHandler.define({
        interactor: 'list-a', name: 'A', category: 'input', properties: '{}',
      }, storage)();
      await interactorHandler.define({
        interactor: 'list-b', name: 'B', category: 'gesture', properties: '{}',
      }, storage)();

      const result = await interactorHandler.list({ category: O.none }, storage)();
      expect(E.isRight(result)).toBe(true);
      if (E.isRight(result)) {
        expect(result.right.variant).toBe('ok');
        const interactors = JSON.parse(result.right.interactors);
        expect(interactors.length).toBeGreaterThanOrEqual(2);
      }
    });

    it('should filter by category', async () => {
      const storage = createTestStorage();
      await interactorHandler.define({
        interactor: 'cat-a', name: 'CatA', category: 'navigation', properties: '{}',
      }, storage)();

      const result = await interactorHandler.list({
        category: O.some('navigation'),
      }, storage)();
      expect(E.isRight(result)).toBe(true);
      if (E.isRight(result)) {
        expect(result.right.variant).toBe('ok');
      }
    });

    it('should return left on storage failure', async () => {
      const storage = createFailingStorage();
      const result = await interactorHandler.list({ category: O.none }, storage)();
      expect(E.isLeft(result)).toBe(true);
    });
  });
});
