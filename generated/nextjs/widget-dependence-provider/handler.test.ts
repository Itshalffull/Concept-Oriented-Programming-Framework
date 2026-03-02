// WidgetDependenceProvider — handler.test.ts
import { describe, it, expect } from 'vitest';
import * as TE from 'fp-ts/TaskEither';
import * as E from 'fp-ts/Either';
import { pipe } from 'fp-ts/function';

import { widgetDependenceProviderHandler } from './handler.js';
import type { WidgetDependenceProviderStorage } from './types.js';

const createTestStorage = (): WidgetDependenceProviderStorage => {
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

const createFailingStorage = (): WidgetDependenceProviderStorage => ({
  get: async () => { throw new Error('storage failure'); },
  put: async () => { throw new Error('storage failure'); },
  delete: async () => { throw new Error('storage failure'); },
  find: async () => { throw new Error('storage failure'); },
});

const handler = widgetDependenceProviderHandler;

describe('WidgetDependenceProvider handler', () => {
  describe('initialize', () => {
    it('should initialize successfully and return ok variant', async () => {
      const storage = createTestStorage();
      const result = await handler.initialize({}, storage)();
      expect(E.isRight(result)).toBe(true);
      if (E.isRight(result)) {
        expect(result.right.variant).toBe('ok');
        if (result.right.variant === 'ok') {
          expect(result.right.instance).toContain('widget-dep-provider-');
        }
      }
    });

    it('should persist provider record to storage', async () => {
      const storage = createTestStorage();
      const result = await handler.initialize({}, storage)();
      expect(E.isRight(result)).toBe(true);
      if (E.isRight(result) && result.right.variant === 'ok') {
        const record = await storage.get('providers', result.right.instance);
        expect(record).not.toBeNull();
        expect(record!['specType']).toBe('widget');
        expect(record!['ruleCount']).toBe(8);
      }
    });

    it('should persist all dependency rules to storage', async () => {
      const storage = createTestStorage();
      const result = await handler.initialize({}, storage)();
      expect(E.isRight(result)).toBe(true);
      if (E.isRight(result) && result.right.variant === 'ok') {
        const rules = await storage.find('dependency_rules');
        expect(rules.length).toBe(8);
      }
    });

    it('should include cross-boundary dependency kinds', async () => {
      const storage = createTestStorage();
      const result = await handler.initialize({}, storage)();
      expect(E.isRight(result)).toBe(true);
      if (E.isRight(result) && result.right.variant === 'ok') {
        const record = await storage.get('providers', result.right.instance);
        expect(record).not.toBeNull();
        const crossBoundary = record!['crossBoundaryKinds'] as string[];
        expect(crossBoundary).toContain('component-reference');
        expect(crossBoundary).toContain('slot-usage');
      }
    });

    it('should return left on storage failure', async () => {
      const storage = createFailingStorage();
      const result = await handler.initialize({}, storage)();
      expect(E.isLeft(result)).toBe(true);
      if (E.isLeft(result)) {
        expect(result.left.code).toBe('STORAGE_ERROR');
      }
    });
  });
});
