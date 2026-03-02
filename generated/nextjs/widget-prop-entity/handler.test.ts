// WidgetPropEntity — handler.test.ts
import { describe, it, expect } from 'vitest';
import * as TE from 'fp-ts/TaskEither';
import * as E from 'fp-ts/Either';
import { pipe } from 'fp-ts/function';

import { widgetPropEntityHandler } from './handler.js';
import type { WidgetPropEntityStorage } from './types.js';

const createTestStorage = (): WidgetPropEntityStorage => {
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

const createFailingStorage = (): WidgetPropEntityStorage => ({
  get: async () => { throw new Error('storage failure'); },
  put: async () => { throw new Error('storage failure'); },
  delete: async () => { throw new Error('storage failure'); },
  find: async () => { throw new Error('storage failure'); },
});

const handler = widgetPropEntityHandler;

describe('WidgetPropEntity handler', () => {
  describe('register', () => {
    it('should register a valid prop successfully', async () => {
      const storage = createTestStorage();
      const result = await handler.register(
        { widget: 'MyWidget', name: 'title', typeExpr: 'string', defaultValue: '"Hello"' },
        storage,
      )();
      expect(E.isRight(result)).toBe(true);
      if (E.isRight(result)) {
        expect(result.right.variant).toBe('ok');
        expect(result.right.prop).toBe('MyWidget::title');
      }
    });

    it('should accept all valid type expressions', async () => {
      const types = ['string', 'number', 'boolean', 'object', 'array', 'enum', 'slot', 'callback'];
      for (const t of types) {
        const storage = createTestStorage();
        const result = await handler.register(
          { widget: 'W', name: `prop_${t}`, typeExpr: t, defaultValue: '' },
          storage,
        )();
        expect(E.isRight(result)).toBe(true);
        if (E.isRight(result)) {
          expect(result.right.variant).toBe('ok');
        }
      }
    });

    it('should accept union type expressions', async () => {
      const storage = createTestStorage();
      const result = await handler.register(
        { widget: 'W', name: 'variant', typeExpr: 'string|number', defaultValue: '' },
        storage,
      )();
      expect(E.isRight(result)).toBe(true);
      if (E.isRight(result)) {
        expect(result.right.variant).toBe('ok');
      }
    });

    it('should return left for invalid type expression', async () => {
      const storage = createTestStorage();
      const result = await handler.register(
        { widget: 'W', name: 'bad', typeExpr: 'invalidtype', defaultValue: '' },
        storage,
      )();
      expect(E.isLeft(result)).toBe(true);
      if (E.isLeft(result)) {
        expect(result.left.code).toBe('INVALID_TYPE');
      }
    });

    it('should persist prop record to storage', async () => {
      const storage = createTestStorage();
      await handler.register(
        { widget: 'W', name: 'title', typeExpr: 'string', defaultValue: '"hi"' },
        storage,
      )();
      const record = await storage.get('props', 'W::title');
      expect(record).not.toBeNull();
      expect(record!['widget']).toBe('W');
      expect(record!['name']).toBe('title');
    });

    it('should return left on storage failure', async () => {
      const storage = createFailingStorage();
      const result = await handler.register(
        { widget: 'W', name: 'title', typeExpr: 'string', defaultValue: '' },
        storage,
      )();
      expect(E.isLeft(result)).toBe(true);
    });
  });

  describe('findByWidget', () => {
    it('should return empty list when no props registered', async () => {
      const storage = createTestStorage();
      const result = await handler.findByWidget(
        { widget: 'MyWidget' },
        storage,
      )();
      expect(E.isRight(result)).toBe(true);
      if (E.isRight(result)) {
        expect(result.right.variant).toBe('ok');
        const props = JSON.parse(result.right.props);
        expect(props).toEqual([]);
      }
    });

    it('should return left on storage failure', async () => {
      const storage = createFailingStorage();
      const result = await handler.findByWidget({ widget: 'W' }, storage)();
      expect(E.isLeft(result)).toBe(true);
    });
  });

  describe('traceToField', () => {
    it('should return noBinding when prop does not exist', async () => {
      const storage = createTestStorage();
      const result = await handler.traceToField(
        { prop: 'nonexistent::prop' },
        storage,
      )();
      expect(E.isRight(result)).toBe(true);
      if (E.isRight(result)) {
        expect(result.right.variant).toBe('noBinding');
      }
    });

    it('should return noBinding when prop exists but no bindings found', async () => {
      const storage = createTestStorage();
      await handler.register(
        { widget: 'W', name: 'title', typeExpr: 'string', defaultValue: '' },
        storage,
      )();
      const result = await handler.traceToField(
        { prop: 'W::title' },
        storage,
      )();
      expect(E.isRight(result)).toBe(true);
      if (E.isRight(result)) {
        expect(result.right.variant).toBe('noBinding');
      }
    });

    it('should return left on storage failure', async () => {
      const storage = createFailingStorage();
      const result = await handler.traceToField({ prop: 'W::x' }, storage)();
      expect(E.isLeft(result)).toBe(true);
    });
  });

  describe('get', () => {
    it('should return notfound when prop does not exist', async () => {
      const storage = createTestStorage();
      const result = await handler.get(
        { prop: 'nonexistent::prop' },
        storage,
      )();
      expect(E.isRight(result)).toBe(true);
      if (E.isRight(result)) {
        expect(result.right.variant).toBe('notfound');
      }
    });

    it('should return ok with full prop details when it exists', async () => {
      const storage = createTestStorage();
      await handler.register(
        { widget: 'W', name: 'title', typeExpr: 'string', defaultValue: '"default"' },
        storage,
      )();
      const result = await handler.get({ prop: 'W::title' }, storage)();
      expect(E.isRight(result)).toBe(true);
      if (E.isRight(result)) {
        expect(result.right.variant).toBe('ok');
        if (result.right.variant === 'ok') {
          expect(result.right.prop).toBe('W::title');
          expect(result.right.widget).toBe('W');
          expect(result.right.name).toBe('title');
          expect(result.right.typeExpr).toBe('string');
          expect(result.right.defaultValue).toBe('"default"');
        }
      }
    });

    it('should return left on storage failure', async () => {
      const storage = createFailingStorage();
      const result = await handler.get({ prop: 'W::x' }, storage)();
      expect(E.isLeft(result)).toBe(true);
    });
  });
});
