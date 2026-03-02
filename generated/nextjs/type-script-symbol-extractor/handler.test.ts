// TypeScriptSymbolExtractor — handler.test.ts
import { describe, it, expect } from 'vitest';
import * as TE from 'fp-ts/TaskEither';
import * as E from 'fp-ts/Either';
import { pipe } from 'fp-ts/function';

import { typeScriptSymbolExtractorHandler } from './handler.js';
import type { TypeScriptSymbolExtractorStorage } from './types.js';

const createTestStorage = (): TypeScriptSymbolExtractorStorage => {
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

const createFailingStorage = (): TypeScriptSymbolExtractorStorage => ({
  get: async () => { throw new Error('storage failure'); },
  put: async () => { throw new Error('storage failure'); },
  delete: async () => { throw new Error('storage failure'); },
  find: async () => { throw new Error('storage failure'); },
});

const handler = typeScriptSymbolExtractorHandler;

describe('TypeScriptSymbolExtractor handler', () => {
  describe('initialize', () => {
    it('should initialize and return an instance id', async () => {
      const storage = createTestStorage();
      const result = await handler.initialize({}, storage)();
      expect(E.isRight(result)).toBe(true);
      if (E.isRight(result)) {
        expect(result.right.variant).toBe('ok');
        if (result.right.variant === 'ok') {
          expect(result.right.instance).toContain('ts-symbol-extractor-');
        }
      }
    });

    it('should persist extractor metadata with supported extensions', async () => {
      const storage = createTestStorage();
      const result = await handler.initialize({}, storage)();
      expect(E.isRight(result)).toBe(true);
      if (E.isRight(result) && result.right.variant === 'ok') {
        const instanceId = result.right.instance;
        const extractor = await storage.get('extractors', instanceId);
        expect(extractor).not.toBeNull();
        expect(extractor?.language).toBe('typescript');
        const extensions = extractor?.supportedExtensions as readonly string[];
        expect(extensions).toContain('.ts');
        expect(extensions).toContain('.tsx');
      }
    });

    it('should register extraction rules for primary symbol kinds', async () => {
      const storage = createTestStorage();
      const result = await handler.initialize({}, storage)();
      expect(E.isRight(result)).toBe(true);
      if (E.isRight(result) && result.right.variant === 'ok') {
        const instanceId = result.right.instance;

        const classRule = await storage.get('extraction_rules', `${instanceId}:class`);
        expect(classRule).not.toBeNull();
        expect(classRule?.nodeType).toBe('class_declaration');
        expect(classRule?.canExport).toBe(true);
        expect(classRule?.canBeDefault).toBe(true);

        const funcRule = await storage.get('extraction_rules', `${instanceId}:function`);
        expect(funcRule).not.toBeNull();
        expect(funcRule?.nodeType).toBe('function_declaration');
        expect(funcRule?.hasTypeSignature).toBe(true);

        const interfaceRule = await storage.get('extraction_rules', `${instanceId}:interface`);
        expect(interfaceRule).not.toBeNull();
        expect(interfaceRule?.canBeDefault).toBe(false);
      }
    });

    it('should include export visibility levels in extractor metadata', async () => {
      const storage = createTestStorage();
      const result = await handler.initialize({}, storage)();
      expect(E.isRight(result)).toBe(true);
      if (E.isRight(result) && result.right.variant === 'ok') {
        const instanceId = result.right.instance;
        const extractor = await storage.get('extractors', instanceId);
        const visibilities = extractor?.exportVisibilities as readonly string[];
        expect(visibilities).toContain('none');
        expect(visibilities).toContain('named');
        expect(visibilities).toContain('default');
        expect(visibilities).toContain('re-export');
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
