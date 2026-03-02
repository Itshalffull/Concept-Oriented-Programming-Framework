// WidgetResolver — handler.test.ts
import { describe, it, expect } from 'vitest';
import * as TE from 'fp-ts/TaskEither';
import * as E from 'fp-ts/Either';
import { pipe } from 'fp-ts/function';

import { widgetResolverHandler } from './handler.js';
import type { WidgetResolverStorage } from './types.js';

const createTestStorage = (): WidgetResolverStorage => {
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

const createFailingStorage = (): WidgetResolverStorage => ({
  get: async () => { throw new Error('storage failure'); },
  put: async () => { throw new Error('storage failure'); },
  delete: async () => { throw new Error('storage failure'); },
  find: async () => { throw new Error('storage failure'); },
});

const handler = widgetResolverHandler;

describe('WidgetResolver handler', () => {
  describe('resolve', () => {
    it('should return none when no candidates exist', async () => {
      const storage = createTestStorage();
      const result = await handler.resolve(
        { resolver: 'r1', element: 'button', context: '{}' },
        storage,
      )();
      expect(E.isRight(result)).toBe(true);
      if (E.isRight(result)) {
        expect(result.right.variant).toBe('none');
        if (result.right.variant === 'none') {
          expect(result.right.element).toBe('button');
        }
      }
    });

    it('should return ok when an override is set', async () => {
      const storage = createTestStorage();
      await storage.put('overrides', 'r1:button', {
        resolver: 'r1',
        element: 'button',
        widget: 'CustomButton',
      });
      const result = await handler.resolve(
        { resolver: 'r1', element: 'button', context: '{}' },
        storage,
      )();
      expect(E.isRight(result)).toBe(true);
      if (E.isRight(result)) {
        expect(result.right.variant).toBe('ok');
        if (result.right.variant === 'ok') {
          expect(result.right.widget).toBe('CustomButton');
          expect(result.right.reason).toBe('manual override');
        }
      }
    });

    it('should return left on storage failure', async () => {
      const storage = createFailingStorage();
      const result = await handler.resolve(
        { resolver: 'r1', element: 'button', context: '{}' },
        storage,
      )();
      expect(E.isLeft(result)).toBe(true);
    });
  });

  describe('resolveAll', () => {
    it('should return partial when some elements have no candidates', async () => {
      const storage = createTestStorage();
      const result = await handler.resolveAll(
        { resolver: 'r1', elements: '["button","input"]', context: '{}' },
        storage,
      )();
      expect(E.isRight(result)).toBe(true);
      if (E.isRight(result)) {
        expect(result.right.variant).toBe('partial');
        if (result.right.variant === 'partial') {
          const unresolved = JSON.parse(result.right.unresolved);
          expect(unresolved).toContain('button');
          expect(unresolved).toContain('input');
        }
      }
    });

    it('should return ok when all elements are resolved via overrides', async () => {
      const storage = createTestStorage();
      await storage.put('overrides', 'r1:button', {
        resolver: 'r1',
        element: 'button',
        widget: 'MyButton',
      });
      await storage.put('overrides', 'r1:input', {
        resolver: 'r1',
        element: 'input',
        widget: 'MyInput',
      });
      const result = await handler.resolveAll(
        { resolver: 'r1', elements: '["button","input"]', context: '{}' },
        storage,
      )();
      expect(E.isRight(result)).toBe(true);
      if (E.isRight(result)) {
        expect(result.right.variant).toBe('ok');
        if (result.right.variant === 'ok') {
          const resolutions = JSON.parse(result.right.resolutions);
          expect(resolutions['button']).toBe('MyButton');
          expect(resolutions['input']).toBe('MyInput');
        }
      }
    });

    it('should return left for invalid elements JSON', async () => {
      const storage = createTestStorage();
      const result = await handler.resolveAll(
        { resolver: 'r1', elements: 'bad-json', context: '{}' },
        storage,
      )();
      expect(E.isLeft(result)).toBe(true);
      if (E.isLeft(result)) {
        expect(result.left.code).toBe('PARSE_ERROR');
      }
    });

    it('should return left on storage failure', async () => {
      const storage = createFailingStorage();
      const result = await handler.resolveAll(
        { resolver: 'r1', elements: '["x"]', context: '{}' },
        storage,
      )();
      expect(E.isLeft(result)).toBe(true);
    });
  });

  describe('override', () => {
    it('should set an override and return ok', async () => {
      const storage = createTestStorage();
      const result = await handler.override(
        { resolver: 'r1', element: 'button', widget: 'MyButton' },
        storage,
      )();
      expect(E.isRight(result)).toBe(true);
      if (E.isRight(result)) {
        expect(result.right.variant).toBe('ok');
      }
    });

    it('should persist override to storage', async () => {
      const storage = createTestStorage();
      await handler.override(
        { resolver: 'r1', element: 'button', widget: 'MyButton' },
        storage,
      )();
      const record = await storage.get('overrides', 'r1:button');
      expect(record).not.toBeNull();
      expect(record!['widget']).toBe('MyButton');
    });

    it('should return invalid for empty widget string', async () => {
      const storage = createTestStorage();
      const result = await handler.override(
        { resolver: 'r1', element: 'button', widget: '' },
        storage,
      )();
      expect(E.isRight(result)).toBe(true);
      if (E.isRight(result)) {
        expect(result.right.variant).toBe('invalid');
      }
    });

    it('should return invalid for whitespace-only widget string', async () => {
      const storage = createTestStorage();
      const result = await handler.override(
        { resolver: 'r1', element: 'button', widget: '   ' },
        storage,
      )();
      expect(E.isRight(result)).toBe(true);
      if (E.isRight(result)) {
        expect(result.right.variant).toBe('invalid');
      }
    });

    it('should return left on storage failure', async () => {
      const storage = createFailingStorage();
      const result = await handler.override(
        { resolver: 'r1', element: 'button', widget: 'X' },
        storage,
      )();
      expect(E.isLeft(result)).toBe(true);
    });
  });

  describe('setWeights', () => {
    it('should set weights successfully', async () => {
      const storage = createTestStorage();
      const result = await handler.setWeights(
        { resolver: 'r1', weights: '{"MyButton":2,"MyInput":1}' },
        storage,
      )();
      expect(E.isRight(result)).toBe(true);
      if (E.isRight(result)) {
        expect(result.right.variant).toBe('ok');
      }
    });

    it('should persist weights to storage', async () => {
      const storage = createTestStorage();
      await handler.setWeights(
        { resolver: 'r1', weights: '{"MyButton":2}' },
        storage,
      )();
      const record = await storage.get('weights', 'r1');
      expect(record).not.toBeNull();
      expect(record!['MyButton']).toBe(2);
    });

    it('should return invalid for non-object weights', async () => {
      const storage = createTestStorage();
      const result = await handler.setWeights(
        { resolver: 'r1', weights: '"not-an-object"' },
        storage,
      )();
      expect(E.isRight(result)).toBe(true);
      if (E.isRight(result)) {
        expect(result.right.variant).toBe('invalid');
      }
    });

    it('should return invalid for negative weight values', async () => {
      const storage = createTestStorage();
      const result = await handler.setWeights(
        { resolver: 'r1', weights: '{"MyButton":-1}' },
        storage,
      )();
      expect(E.isRight(result)).toBe(true);
      if (E.isRight(result)) {
        expect(result.right.variant).toBe('invalid');
      }
    });

    it('should return invalid for non-numeric weight values', async () => {
      const storage = createTestStorage();
      const result = await handler.setWeights(
        { resolver: 'r1', weights: '{"MyButton":"high"}' },
        storage,
      )();
      expect(E.isRight(result)).toBe(true);
      if (E.isRight(result)) {
        expect(result.right.variant).toBe('invalid');
      }
    });

    it('should return invalid for invalid JSON', async () => {
      const storage = createTestStorage();
      const result = await handler.setWeights(
        { resolver: 'r1', weights: 'bad{json' },
        storage,
      )();
      expect(E.isRight(result)).toBe(true);
      if (E.isRight(result)) {
        expect(result.right.variant).toBe('invalid');
      }
    });
  });

  describe('explain', () => {
    it('should return notfound when no candidates exist', async () => {
      const storage = createTestStorage();
      const result = await handler.explain(
        { resolver: 'r1', element: 'button', context: '{}' },
        storage,
      )();
      expect(E.isRight(result)).toBe(true);
      if (E.isRight(result)) {
        expect(result.right.variant).toBe('notfound');
      }
    });

    it('should return left on storage failure', async () => {
      const storage = createFailingStorage();
      const result = await handler.explain(
        { resolver: 'r1', element: 'button', context: '{}' },
        storage,
      )();
      expect(E.isLeft(result)).toBe(true);
    });
  });
});
