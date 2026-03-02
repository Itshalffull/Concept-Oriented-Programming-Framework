// Widget — handler.test.ts
import { describe, it, expect } from 'vitest';
import * as TE from 'fp-ts/TaskEither';
import * as E from 'fp-ts/Either';
import * as O from 'fp-ts/Option';
import { pipe } from 'fp-ts/function';

import { widgetHandler } from './handler.js';
import type { WidgetStorage } from './types.js';

const createTestStorage = (): WidgetStorage => {
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

const createFailingStorage = (): WidgetStorage => ({
  get: async () => { throw new Error('storage failure'); },
  put: async () => { throw new Error('storage failure'); },
  delete: async () => { throw new Error('storage failure'); },
  find: async () => { throw new Error('storage failure'); },
});

const handler = widgetHandler;

describe('Widget handler', () => {
  describe('register', () => {
    it('should register a new widget successfully', async () => {
      const storage = createTestStorage();
      const result = await handler.register(
        { widget: 'w-1', name: 'MyWidget', ast: '{}', category: 'display' },
        storage,
      )();
      expect(E.isRight(result)).toBe(true);
      if (E.isRight(result)) {
        expect(result.right.variant).toBe('ok');
        if (result.right.variant === 'ok') {
          expect(result.right.widget).toBe('w-1');
        }
      }
    });

    it('should return duplicate variant when widget already registered', async () => {
      const storage = createTestStorage();
      await handler.register(
        { widget: 'w-1', name: 'MyWidget', ast: '{}', category: 'display' },
        storage,
      )();
      const result = await handler.register(
        { widget: 'w-1', name: 'MyWidget', ast: '{}', category: 'display' },
        storage,
      )();
      expect(E.isRight(result)).toBe(true);
      if (E.isRight(result)) {
        expect(result.right.variant).toBe('duplicate');
      }
    });

    it('should return invalid variant for bad widget name', async () => {
      const storage = createTestStorage();
      const result = await handler.register(
        { widget: 'w-1', name: '123bad', ast: '{}', category: 'display' },
        storage,
      )();
      expect(E.isRight(result)).toBe(true);
      if (E.isRight(result)) {
        expect(result.right.variant).toBe('invalid');
      }
    });

    it('should return invalid variant for bad category', async () => {
      const storage = createTestStorage();
      const result = await handler.register(
        { widget: 'w-1', name: 'MyWidget', ast: '{}', category: 'unknowncat' },
        storage,
      )();
      expect(E.isRight(result)).toBe(true);
      if (E.isRight(result)) {
        expect(result.right.variant).toBe('invalid');
      }
    });

    it('should accept all valid categories', async () => {
      const categories = ['display', 'input', 'layout', 'navigation', 'feedback', 'data', 'composite'];
      for (const cat of categories) {
        const storage = createTestStorage();
        const result = await handler.register(
          { widget: `w-${cat}`, name: 'ValidWidget', ast: '{}', category: cat },
          storage,
        )();
        expect(E.isRight(result)).toBe(true);
        if (E.isRight(result)) {
          expect(result.right.variant).toBe('ok');
        }
      }
    });

    it('should return left on storage failure', async () => {
      const storage = createFailingStorage();
      const result = await handler.register(
        { widget: 'w-1', name: 'MyWidget', ast: '{}', category: 'display' },
        storage,
      )();
      expect(E.isLeft(result)).toBe(true);
    });
  });

  describe('get', () => {
    it('should return notfound when widget does not exist', async () => {
      const storage = createTestStorage();
      const result = await handler.get({ widget: 'w-none' }, storage)();
      expect(E.isRight(result)).toBe(true);
      if (E.isRight(result)) {
        expect(result.right.variant).toBe('notfound');
      }
    });

    it('should return ok with widget data when widget exists', async () => {
      const storage = createTestStorage();
      await handler.register(
        { widget: 'w-1', name: 'MyWidget', ast: '{"tree":true}', category: 'display' },
        storage,
      )();
      const result = await handler.get({ widget: 'w-1' }, storage)();
      expect(E.isRight(result)).toBe(true);
      if (E.isRight(result)) {
        expect(result.right.variant).toBe('ok');
        if (result.right.variant === 'ok') {
          expect(result.right.widget).toBe('w-1');
          expect(result.right.name).toBe('MyWidget');
        }
      }
    });

    it('should return left on storage failure', async () => {
      const storage = createFailingStorage();
      const result = await handler.get({ widget: 'w-1' }, storage)();
      expect(E.isLeft(result)).toBe(true);
    });
  });

  describe('list', () => {
    it('should return empty list when no widgets registered', async () => {
      const storage = createTestStorage();
      const result = await handler.list({ category: O.none }, storage)();
      expect(E.isRight(result)).toBe(true);
      if (E.isRight(result)) {
        expect(result.right.variant).toBe('ok');
        const widgets = JSON.parse(result.right.widgets);
        expect(widgets).toEqual([]);
      }
    });

    it('should return all widgets when category is none', async () => {
      const storage = createTestStorage();
      await handler.register(
        { widget: 'w-1', name: 'Widget1', ast: '{}', category: 'display' },
        storage,
      )();
      await handler.register(
        { widget: 'w-2', name: 'Widget2', ast: '{}', category: 'input' },
        storage,
      )();
      const result = await handler.list({ category: O.none }, storage)();
      expect(E.isRight(result)).toBe(true);
      if (E.isRight(result)) {
        const widgets = JSON.parse(result.right.widgets);
        expect(widgets.length).toBe(2);
      }
    });

    it('should return left on storage failure', async () => {
      const storage = createFailingStorage();
      const result = await handler.list({ category: O.none }, storage)();
      expect(E.isLeft(result)).toBe(true);
    });
  });

  describe('unregister', () => {
    it('should return notfound when widget does not exist', async () => {
      const storage = createTestStorage();
      const result = await handler.unregister({ widget: 'w-none' }, storage)();
      expect(E.isRight(result)).toBe(true);
      if (E.isRight(result)) {
        expect(result.right.variant).toBe('notfound');
      }
    });

    it('should unregister existing widget successfully', async () => {
      const storage = createTestStorage();
      await handler.register(
        { widget: 'w-1', name: 'MyWidget', ast: '{}', category: 'display' },
        storage,
      )();
      const result = await handler.unregister({ widget: 'w-1' }, storage)();
      expect(E.isRight(result)).toBe(true);
      if (E.isRight(result)) {
        expect(result.right.variant).toBe('ok');
        if (result.right.variant === 'ok') {
          expect(result.right.widget).toBe('w-1');
        }
      }
    });

    it('should make widget not found after unregister', async () => {
      const storage = createTestStorage();
      await handler.register(
        { widget: 'w-1', name: 'MyWidget', ast: '{}', category: 'display' },
        storage,
      )();
      await handler.unregister({ widget: 'w-1' }, storage)();
      const result = await handler.get({ widget: 'w-1' }, storage)();
      expect(E.isRight(result)).toBe(true);
      if (E.isRight(result)) {
        expect(result.right.variant).toBe('notfound');
      }
    });

    it('should return left on storage failure', async () => {
      const storage = createFailingStorage();
      const result = await handler.unregister({ widget: 'w-1' }, storage)();
      expect(E.isLeft(result)).toBe(true);
    });
  });
});
