// AnatomyPartEntity — handler.test.ts
// Unit tests for anatomyPartEntity handler actions.

import { describe, it, expect } from 'vitest';
import * as TE from 'fp-ts/TaskEither';
import * as E from 'fp-ts/Either';
import { pipe } from 'fp-ts/function';

import { anatomyPartEntityHandler } from './handler.js';
import type { AnatomyPartEntityStorage } from './types.js';

const createTestStorage = (): AnatomyPartEntityStorage => {
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

const createFailingStorage = (): AnatomyPartEntityStorage => ({
  get: async () => { throw new Error('storage failure'); },
  put: async () => { throw new Error('storage failure'); },
  delete: async () => { throw new Error('storage failure'); },
  find: async () => { throw new Error('storage failure'); },
});

describe('AnatomyPartEntity handler', () => {
  describe('register', () => {
    it('registers successfully with valid input', async () => {
      const storage = createTestStorage();
      const result = await anatomyPartEntityHandler.register(
        { widget: 'card', name: 'header', role: 'header', required: 'true' },
        storage,
      )();
      expect(E.isRight(result)).toBe(true);
      if (E.isRight(result)) {
        expect(result.right.variant).toBe('ok');
        expect(result.right.part).toBe('card::header');
      }
    });

    it('normalizes invalid role to content', async () => {
      const storage = createTestStorage();
      const result = await anatomyPartEntityHandler.register(
        { widget: 'card', name: 'custom', role: 'invalid-role', required: 'false' },
        storage,
      )();
      expect(E.isRight(result)).toBe(true);
      if (E.isRight(result)) {
        expect(result.right.variant).toBe('ok');
      }
    });

    it('propagates storage errors', async () => {
      const storage = createFailingStorage();
      const result = await anatomyPartEntityHandler.register(
        { widget: 'card', name: 'header', role: 'header', required: 'true' },
        storage,
      )();
      expect(E.isLeft(result)).toBe(true);
    });
  });

  describe('findByRole', () => {
    it('produces ok with valid input', async () => {
      const storage = createTestStorage();
      await anatomyPartEntityHandler.register(
        { widget: 'card', name: 'header', role: 'header', required: 'true' },
        storage,
      )();
      const result = await anatomyPartEntityHandler.findByRole(
        { role: 'header' },
        storage,
      )();
      expect(E.isRight(result)).toBe(true);
      if (E.isRight(result)) {
        expect(result.right.variant).toBe('ok');
      }
    });

    it('propagates storage errors', async () => {
      const storage = createFailingStorage();
      const result = await anatomyPartEntityHandler.findByRole(
        { role: 'header' },
        storage,
      )();
      expect(E.isLeft(result)).toBe(true);
    });
  });

  describe('findBoundToField', () => {
    it('produces ok with valid input', async () => {
      const storage = createTestStorage();
      const result = await anatomyPartEntityHandler.findBoundToField(
        { field: 'title' },
        storage,
      )();
      expect(E.isRight(result)).toBe(true);
      if (E.isRight(result)) {
        expect(result.right.variant).toBe('ok');
      }
    });

    it('propagates storage errors', async () => {
      const storage = createFailingStorage();
      const result = await anatomyPartEntityHandler.findBoundToField(
        { field: 'title' },
        storage,
      )();
      expect(E.isLeft(result)).toBe(true);
    });
  });

  describe('findBoundToAction', () => {
    it('produces ok with valid input', async () => {
      const storage = createTestStorage();
      const result = await anatomyPartEntityHandler.findBoundToAction(
        { action: 'submit' },
        storage,
      )();
      expect(E.isRight(result)).toBe(true);
      if (E.isRight(result)) {
        expect(result.right.variant).toBe('ok');
      }
    });

    it('propagates storage errors', async () => {
      const storage = createFailingStorage();
      const result = await anatomyPartEntityHandler.findBoundToAction(
        { action: 'submit' },
        storage,
      )();
      expect(E.isLeft(result)).toBe(true);
    });
  });

  describe('get', () => {
    it('returns notfound for missing part', async () => {
      const storage = createTestStorage();
      const result = await anatomyPartEntityHandler.get(
        { part: 'nonexistent::part' },
        storage,
      )();
      expect(E.isRight(result)).toBe(true);
      if (E.isRight(result)) {
        expect(result.right.variant).toBe('notfound');
      }
    });

    it('returns part after register', async () => {
      const storage = createTestStorage();
      await anatomyPartEntityHandler.register(
        { widget: 'card', name: 'body', role: 'body', required: 'false' },
        storage,
      )();
      const result = await anatomyPartEntityHandler.get(
        { part: 'card::body' },
        storage,
      )();
      expect(E.isRight(result)).toBe(true);
      if (E.isRight(result)) {
        expect(result.right.variant).toBe('ok');
        if (result.right.variant === 'ok') {
          expect(result.right.widget).toBe('card');
          expect(result.right.name).toBe('body');
          expect(result.right.semanticRole).toBe('body');
        }
      }
    });

    it('propagates storage errors', async () => {
      const storage = createFailingStorage();
      const result = await anatomyPartEntityHandler.get(
        { part: 'card::header' },
        storage,
      )();
      expect(E.isLeft(result)).toBe(true);
    });
  });
});
