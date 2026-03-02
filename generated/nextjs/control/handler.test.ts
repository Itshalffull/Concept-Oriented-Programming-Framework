// Control — handler.test.ts
// Unit tests for control handler actions.

import { describe, it, expect } from 'vitest';
import * as E from 'fp-ts/Either';

import { controlHandler } from './handler.js';
import type { ControlStorage } from './types.js';

const createTestStorage = (): ControlStorage => {
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

const createFailingStorage = (): ControlStorage => ({
  get: async () => { throw new Error('storage failure'); },
  put: async () => { throw new Error('storage failure'); },
  delete: async () => { throw new Error('storage failure'); },
  find: async () => { throw new Error('storage failure'); },
});

describe('Control handler', () => {
  describe('create', () => {
    it('returns ok when control does not exist', async () => {
      const storage = createTestStorage();
      const result = await controlHandler.create(
        { control: 'my-input', type: 'text', binding: 'name' },
        storage,
      )();
      expect(E.isRight(result)).toBe(true);
      if (E.isRight(result)) {
        expect(result.right.variant).toBe('ok');
      }
    });

    it('returns exists when control already exists', async () => {
      const storage = createTestStorage();
      await controlHandler.create({ control: 'my-input', type: 'text', binding: 'name' }, storage)();
      const result = await controlHandler.create(
        { control: 'my-input', type: 'text', binding: 'name' },
        storage,
      )();
      expect(E.isRight(result)).toBe(true);
      if (E.isRight(result)) {
        expect(result.right.variant).toBe('exists');
      }
    });

    it('returns left on storage failure', async () => {
      const storage = createFailingStorage();
      const result = await controlHandler.create(
        { control: 'my-input', type: 'text', binding: 'name' },
        storage,
      )();
      expect(E.isLeft(result)).toBe(true);
    });
  });

  describe('interact', () => {
    it('returns ok when control exists', async () => {
      const storage = createTestStorage();
      await controlHandler.create({ control: 'my-input', type: 'text', binding: 'name' }, storage)();
      const result = await controlHandler.interact(
        { control: 'my-input', input: 'hello' },
        storage,
      )();
      expect(E.isRight(result)).toBe(true);
      if (E.isRight(result)) {
        expect(result.right.variant).toBe('ok');
      }
    });

    it('returns notfound when control does not exist', async () => {
      const storage = createTestStorage();
      const result = await controlHandler.interact(
        { control: 'missing', input: 'hello' },
        storage,
      )();
      expect(E.isRight(result)).toBe(true);
      if (E.isRight(result)) {
        expect(result.right.variant).toBe('notfound');
      }
    });

    it('returns left on storage failure', async () => {
      const storage = createFailingStorage();
      const result = await controlHandler.interact(
        { control: 'my-input', input: 'hello' },
        storage,
      )();
      expect(E.isLeft(result)).toBe(true);
    });
  });

  describe('getValue', () => {
    it('returns ok with value when control exists', async () => {
      const storage = createTestStorage();
      await controlHandler.create({ control: 'my-input', type: 'text', binding: 'name' }, storage)();
      const result = await controlHandler.getValue({ control: 'my-input' }, storage)();
      expect(E.isRight(result)).toBe(true);
      if (E.isRight(result)) {
        expect(result.right.variant).toBe('ok');
      }
    });

    it('returns notfound when control does not exist', async () => {
      const storage = createTestStorage();
      const result = await controlHandler.getValue({ control: 'missing' }, storage)();
      expect(E.isRight(result)).toBe(true);
      if (E.isRight(result)) {
        expect(result.right.variant).toBe('notfound');
      }
    });

    it('returns left on storage failure', async () => {
      const storage = createFailingStorage();
      const result = await controlHandler.getValue({ control: 'my-input' }, storage)();
      expect(E.isLeft(result)).toBe(true);
    });
  });

  describe('setValue', () => {
    it('returns ok when control exists and value is valid', async () => {
      const storage = createTestStorage();
      await controlHandler.create({ control: 'my-input', type: 'text', binding: 'name' }, storage)();
      const result = await controlHandler.setValue(
        { control: 'my-input', value: 'new-value' },
        storage,
      )();
      expect(E.isRight(result)).toBe(true);
      if (E.isRight(result)) {
        expect(result.right.variant).toBe('ok');
      }
    });

    it('returns notfound when control does not exist', async () => {
      const storage = createTestStorage();
      const result = await controlHandler.setValue(
        { control: 'missing', value: 'new-value' },
        storage,
      )();
      expect(E.isRight(result)).toBe(true);
      if (E.isRight(result)) {
        expect(result.right.variant).toBe('notfound');
      }
    });

    it('returns left on storage failure', async () => {
      const storage = createFailingStorage();
      const result = await controlHandler.setValue(
        { control: 'my-input', value: 'new-value' },
        storage,
      )();
      expect(E.isLeft(result)).toBe(true);
    });
  });

  describe('triggerAction', () => {
    it('returns ok when control exists', async () => {
      const storage = createTestStorage();
      await controlHandler.create({ control: 'my-btn', type: 'text', binding: 'submit' }, storage)();
      const result = await controlHandler.triggerAction({ control: 'my-btn' }, storage)();
      expect(E.isRight(result)).toBe(true);
      if (E.isRight(result)) {
        expect(result.right.variant).toBe('ok');
      }
    });

    it('returns notfound when control does not exist', async () => {
      const storage = createTestStorage();
      const result = await controlHandler.triggerAction({ control: 'missing' }, storage)();
      expect(E.isRight(result)).toBe(true);
      if (E.isRight(result)) {
        expect(result.right.variant).toBe('notfound');
      }
    });

    it('returns left on storage failure', async () => {
      const storage = createFailingStorage();
      const result = await controlHandler.triggerAction({ control: 'my-btn' }, storage)();
      expect(E.isLeft(result)).toBe(true);
    });
  });
});
