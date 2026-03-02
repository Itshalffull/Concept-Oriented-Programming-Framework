// WidgetScopeProvider — handler.test.ts
import { describe, it, expect } from 'vitest';
import * as TE from 'fp-ts/TaskEither';
import * as E from 'fp-ts/Either';
import { pipe } from 'fp-ts/function';

import { widgetScopeProviderHandler } from './handler.js';
import type { WidgetScopeProviderStorage } from './types.js';

const createTestStorage = (): WidgetScopeProviderStorage => {
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

const createFailingStorage = (): WidgetScopeProviderStorage => ({
  get: async () => { throw new Error('storage failure'); },
  put: async () => { throw new Error('storage failure'); },
  delete: async () => { throw new Error('storage failure'); },
  find: async () => { throw new Error('storage failure'); },
});

const handler = widgetScopeProviderHandler;

describe('WidgetScopeProvider handler', () => {
  describe('initialize', () => {
    it('should initialize successfully and return ok variant', async () => {
      const storage = createTestStorage();
      const result = await handler.initialize({}, storage)();
      expect(E.isRight(result)).toBe(true);
      if (E.isRight(result)) {
        expect(result.right.variant).toBe('ok');
        if (result.right.variant === 'ok') {
          expect(result.right.instance).toContain('widget-scope-');
        }
      }
    });

    it('should persist provider record with scope and name kinds', async () => {
      const storage = createTestStorage();
      const result = await handler.initialize({}, storage)();
      expect(E.isRight(result)).toBe(true);
      if (E.isRight(result) && result.right.variant === 'ok') {
        const record = await storage.get('providers', result.right.instance);
        expect(record).not.toBeNull();
        expect(record!['specType']).toBe('widget');
        const scopeKinds = record!['scopeKinds'] as string[];
        expect(scopeKinds).toContain('widget');
        expect(scopeKinds).toContain('props');
        expect(scopeKinds).toContain('state');
        expect(scopeKinds).toContain('render');
      }
    });

    it('should persist binding rules to storage', async () => {
      const storage = createTestStorage();
      const result = await handler.initialize({}, storage)();
      expect(E.isRight(result)).toBe(true);
      if (E.isRight(result) && result.right.variant === 'ok') {
        const rules = await storage.find('binding_rules');
        expect(rules.length).toBe(7);
      }
    });

    it('should persist nesting rules to storage', async () => {
      const storage = createTestStorage();
      const result = await handler.initialize({}, storage)();
      expect(E.isRight(result)).toBe(true);
      if (E.isRight(result) && result.right.variant === 'ok') {
        const rules = await storage.find('nesting_rules');
        expect(rules.length).toBe(4);
      }
    });

    it('should include correct binding rule count in provider record', async () => {
      const storage = createTestStorage();
      const result = await handler.initialize({}, storage)();
      expect(E.isRight(result)).toBe(true);
      if (E.isRight(result) && result.right.variant === 'ok') {
        const record = await storage.get('providers', result.right.instance);
        expect(record!['bindingRuleCount']).toBe(7);
        expect(record!['nestingRuleCount']).toBe(4);
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
