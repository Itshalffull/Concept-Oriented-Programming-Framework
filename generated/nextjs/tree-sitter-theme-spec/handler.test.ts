// TreeSitterThemeSpec — handler.test.ts
import { describe, it, expect } from 'vitest';
import * as TE from 'fp-ts/TaskEither';
import * as E from 'fp-ts/Either';
import { pipe } from 'fp-ts/function';

import { treeSitterThemeSpecHandler } from './handler.js';
import type { TreeSitterThemeSpecStorage } from './types.js';

const createTestStorage = (): TreeSitterThemeSpecStorage => {
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

const createFailingStorage = (): TreeSitterThemeSpecStorage => ({
  get: async () => { throw new Error('storage failure'); },
  put: async () => { throw new Error('storage failure'); },
  delete: async () => { throw new Error('storage failure'); },
  find: async () => { throw new Error('storage failure'); },
});

const handler = treeSitterThemeSpecHandler;

describe('TreeSitterThemeSpec handler', () => {
  describe('initialize', () => {
    it('should initialize and return an instance id', async () => {
      const storage = createTestStorage();
      const result = await handler.initialize({}, storage)();
      expect(E.isRight(result)).toBe(true);
      if (E.isRight(result)) {
        expect(result.right.variant).toBe('ok');
        if (result.right.variant === 'ok') {
          expect(result.right.instance).toContain('theme-spec-grammar-');
        }
      }
    });

    it('should persist grammar metadata with design token support', async () => {
      const storage = createTestStorage();
      const result = await handler.initialize({}, storage)();
      expect(E.isRight(result)).toBe(true);
      if (E.isRight(result) && result.right.variant === 'ok') {
        const instanceId = result.right.instance;
        const grammar = await storage.get('grammars', instanceId);
        expect(grammar).not.toBeNull();
        expect(grammar?.language).toBe('theme-spec');
        expect(grammar?.supportsDesignTokens).toBe(true);
        expect(grammar?.supportsInheritance).toBe(true);
      }
    });

    it('should categorize node types by domain', async () => {
      const storage = createTestStorage();
      const result = await handler.initialize({}, storage)();
      expect(E.isRight(result)).toBe(true);
      if (E.isRight(result) && result.right.variant === 'ok') {
        const instanceId = result.right.instance;
        const colorNode = await storage.get('node_types', `${instanceId}:color_declaration`);
        expect(colorNode).not.toBeNull();
        expect(colorNode?.category).toBe('color');

        const fontNode = await storage.get('node_types', `${instanceId}:font_family_declaration`);
        expect(fontNode).not.toBeNull();
        expect(fontNode?.category).toBe('typography');

        const tokenNode = await storage.get('node_types', `${instanceId}:token_declaration`);
        expect(tokenNode).not.toBeNull();
        expect(tokenNode?.category).toBe('token');
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
