// TypeScriptDependenceProvider — handler.test.ts
import { describe, it, expect } from 'vitest';
import * as TE from 'fp-ts/TaskEither';
import * as E from 'fp-ts/Either';
import { pipe } from 'fp-ts/function';

import { typeScriptDependenceProviderHandler } from './handler.js';
import type { TypeScriptDependenceProviderStorage } from './types.js';

const createTestStorage = (): TypeScriptDependenceProviderStorage => {
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

const createFailingStorage = (): TypeScriptDependenceProviderStorage => ({
  get: async () => { throw new Error('storage failure'); },
  put: async () => { throw new Error('storage failure'); },
  delete: async () => { throw new Error('storage failure'); },
  find: async () => { throw new Error('storage failure'); },
});

const handler = typeScriptDependenceProviderHandler;

describe('TypeScriptDependenceProvider handler', () => {
  describe('initialize', () => {
    it('should initialize and return an instance id', async () => {
      const storage = createTestStorage();
      const result = await handler.initialize({}, storage)();
      expect(E.isRight(result)).toBe(true);
      if (E.isRight(result)) {
        expect(result.right.variant).toBe('ok');
        if (result.right.variant === 'ok') {
          expect(result.right.instance).toContain('ts-dependence-');
        }
      }
    });

    it('should persist provider metadata with supported extensions', async () => {
      const storage = createTestStorage();
      const result = await handler.initialize({}, storage)();
      expect(E.isRight(result)).toBe(true);
      if (E.isRight(result) && result.right.variant === 'ok') {
        const instanceId = result.right.instance;
        const provider = await storage.get('providers', instanceId);
        expect(provider).not.toBeNull();
        expect(provider?.language).toBe('typescript');
        const extensions = provider?.supportedExtensions as readonly string[];
        expect(extensions).toContain('.ts');
        expect(extensions).toContain('.tsx');
        expect(extensions).toContain('.mts');
      }
    });

    it('should register extraction rules for all dependency kinds', async () => {
      const storage = createTestStorage();
      const result = await handler.initialize({}, storage)();
      expect(E.isRight(result)).toBe(true);
      if (E.isRight(result) && result.right.variant === 'ok') {
        const instanceId = result.right.instance;
        const staticImport = await storage.get('extraction_rules', `${instanceId}:static-import`);
        expect(staticImport).not.toBeNull();
        expect(staticImport?.kind).toBe('static-import');

        const dynamicImport = await storage.get('extraction_rules', `${instanceId}:dynamic-import`);
        expect(dynamicImport).not.toBeNull();

        const requireRule = await storage.get('extraction_rules', `${instanceId}:require`);
        expect(requireRule).not.toBeNull();

        const reExport = await storage.get('extraction_rules', `${instanceId}:re-export`);
        expect(reExport).not.toBeNull();

        const typeImport = await storage.get('extraction_rules', `${instanceId}:type-import`);
        expect(typeImport).not.toBeNull();
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
