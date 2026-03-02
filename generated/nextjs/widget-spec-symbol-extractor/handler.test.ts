// WidgetSpecSymbolExtractor — handler.test.ts
import { describe, it, expect } from 'vitest';
import * as TE from 'fp-ts/TaskEither';
import * as E from 'fp-ts/Either';
import { pipe } from 'fp-ts/function';

import { widgetSpecSymbolExtractorHandler } from './handler.js';
import type { WidgetSpecSymbolExtractorStorage } from './types.js';

const createTestStorage = (): WidgetSpecSymbolExtractorStorage => {
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

const createFailingStorage = (): WidgetSpecSymbolExtractorStorage => ({
  get: async () => { throw new Error('storage failure'); },
  put: async () => { throw new Error('storage failure'); },
  delete: async () => { throw new Error('storage failure'); },
  find: async () => { throw new Error('storage failure'); },
});

const handler = widgetSpecSymbolExtractorHandler;

describe('WidgetSpecSymbolExtractor handler', () => {
  describe('initialize', () => {
    it('should initialize successfully and return ok variant', async () => {
      const storage = createTestStorage();
      const result = await handler.initialize({}, storage)();
      expect(E.isRight(result)).toBe(true);
      if (E.isRight(result)) {
        expect(result.right.variant).toBe('ok');
        if (result.right.variant === 'ok') {
          expect(result.right.instance).toContain('widget-symbol-extractor-');
        }
      }
    });

    it('should persist extractor record with symbol kinds', async () => {
      const storage = createTestStorage();
      const result = await handler.initialize({}, storage)();
      expect(E.isRight(result)).toBe(true);
      if (E.isRight(result) && result.right.variant === 'ok') {
        const record = await storage.get('extractors', result.right.instance);
        expect(record).not.toBeNull();
        expect(record!['specType']).toBe('widget');
        expect(record!['ruleCount']).toBe(10);
        const symbolKinds = record!['symbolKinds'] as string[];
        expect(symbolKinds).toContain('widget');
        expect(symbolKinds).toContain('prop');
        expect(symbolKinds).toContain('slot');
        expect(symbolKinds).toContain('event');
        expect(symbolKinds).toContain('state-field');
      }
    });

    it('should track public and typed symbol kinds', async () => {
      const storage = createTestStorage();
      const result = await handler.initialize({}, storage)();
      expect(E.isRight(result)).toBe(true);
      if (E.isRight(result) && result.right.variant === 'ok') {
        const record = await storage.get('extractors', result.right.instance);
        const publicKinds = record!['publicKinds'] as string[];
        expect(publicKinds).toContain('widget');
        expect(publicKinds).toContain('prop');
        expect(publicKinds).toContain('slot');
        expect(publicKinds).toContain('event');
        const typedKinds = record!['typedKinds'] as string[];
        expect(typedKinds).toContain('prop');
        expect(typedKinds).toContain('state-field');
      }
    });

    it('should persist all extraction rules to storage', async () => {
      const storage = createTestStorage();
      const result = await handler.initialize({}, storage)();
      expect(E.isRight(result)).toBe(true);
      if (E.isRight(result) && result.right.variant === 'ok') {
        const rules = await storage.find('extraction_rules');
        expect(rules.length).toBe(10);
      }
    });

    it('should include visibility in extraction rules', async () => {
      const storage = createTestStorage();
      const result = await handler.initialize({}, storage)();
      expect(E.isRight(result)).toBe(true);
      if (E.isRight(result) && result.right.variant === 'ok') {
        const rules = await storage.find('extraction_rules');
        const propRule = rules.find(r => r['symbolKind'] === 'prop');
        expect(propRule).not.toBeUndefined();
        expect(propRule!['visibility']).toBe('public-api');
        const stateRule = rules.find(r => r['symbolKind'] === 'state-field');
        expect(stateRule!['visibility']).toBe('internal');
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
