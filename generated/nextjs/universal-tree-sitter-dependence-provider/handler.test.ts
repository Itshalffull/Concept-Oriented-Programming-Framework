// UniversalTreeSitterDependenceProvider — handler.test.ts
import { describe, it, expect } from 'vitest';
import * as TE from 'fp-ts/TaskEither';
import * as E from 'fp-ts/Either';
import { pipe } from 'fp-ts/function';

import { universalTreeSitterDependenceProviderHandler } from './handler.js';
import type { UniversalTreeSitterDependenceProviderStorage } from './types.js';

const createTestStorage = (): UniversalTreeSitterDependenceProviderStorage => {
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

const createFailingStorage = (): UniversalTreeSitterDependenceProviderStorage => ({
  get: async () => { throw new Error('storage failure'); },
  put: async () => { throw new Error('storage failure'); },
  delete: async () => { throw new Error('storage failure'); },
  find: async () => { throw new Error('storage failure'); },
});

const handler = universalTreeSitterDependenceProviderHandler;

describe('UniversalTreeSitterDependenceProvider handler', () => {
  describe('initialize', () => {
    it('should initialize and return a provider instance ID', async () => {
      const storage = createTestStorage();
      const result = await handler.initialize({}, storage)();
      expect(E.isRight(result)).toBe(true);
      if (E.isRight(result)) {
        expect(result.right.variant).toBe('ok');
        if (result.right.variant === 'ok') {
          expect(result.right.instance).toContain('universal-dep-provider-');
        }
      }
    });

    it('should persist provider metadata to storage', async () => {
      const storage = createTestStorage();
      const result = await handler.initialize({}, storage)();
      expect(E.isRight(result)).toBe(true);
      if (E.isRight(result) && result.right.variant === 'ok') {
        const stored = await storage.get('providers', result.right.instance);
        expect(stored).not.toBeNull();
        expect(stored!.instanceId).toBe(result.right.instance);
        expect(Array.isArray(stored!.supportedLanguages)).toBe(true);
        const languages = stored!.supportedLanguages as string[];
        expect(languages).toContain('typescript');
        expect(languages).toContain('rust');
        expect(languages).toContain('python');
        expect(languages).toContain('go');
        expect(languages).toContain('swift');
        expect(languages).toContain('solidity');
      }
    });

    it('should persist per-language configs to storage', async () => {
      const storage = createTestStorage();
      const result = await handler.initialize({}, storage)();
      expect(E.isRight(result)).toBe(true);
      if (E.isRight(result) && result.right.variant === 'ok') {
        const instanceId = result.right.instance;
        const tsConfig = await storage.get('language_configs', `${instanceId}:typescript`);
        expect(tsConfig).not.toBeNull();
        expect(tsConfig!.language).toBe('typescript');
        expect(tsConfig!.queryPattern).toBeDefined();
      }
    });

    it('should include extension map in provider metadata', async () => {
      const storage = createTestStorage();
      const result = await handler.initialize({}, storage)();
      expect(E.isRight(result)).toBe(true);
      if (E.isRight(result) && result.right.variant === 'ok') {
        const stored = await storage.get('providers', result.right.instance);
        expect(stored).not.toBeNull();
        const extensionMap = stored!.extensionMap as Record<string, string>;
        expect(extensionMap['.ts']).toBe('typescript');
        expect(extensionMap['.rs']).toBe('rust');
        expect(extensionMap['.py']).toBe('python');
        expect(extensionMap['.go']).toBe('go');
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
