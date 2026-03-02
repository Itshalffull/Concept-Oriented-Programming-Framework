// UniversalTreeSitterExtractor — handler.test.ts
import { describe, it, expect } from 'vitest';
import * as TE from 'fp-ts/TaskEither';
import * as E from 'fp-ts/Either';
import { pipe } from 'fp-ts/function';

import { universalTreeSitterExtractorHandler } from './handler.js';
import type { UniversalTreeSitterExtractorStorage } from './types.js';

const createTestStorage = (): UniversalTreeSitterExtractorStorage => {
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

const createFailingStorage = (): UniversalTreeSitterExtractorStorage => ({
  get: async () => { throw new Error('storage failure'); },
  put: async () => { throw new Error('storage failure'); },
  delete: async () => { throw new Error('storage failure'); },
  find: async () => { throw new Error('storage failure'); },
});

const handler = universalTreeSitterExtractorHandler;

describe('UniversalTreeSitterExtractor handler', () => {
  describe('initialize', () => {
    it('should initialize and return an extractor instance ID', async () => {
      const storage = createTestStorage();
      const result = await handler.initialize({}, storage)();
      expect(E.isRight(result)).toBe(true);
      if (E.isRight(result)) {
        expect(result.right.variant).toBe('ok');
        if (result.right.variant === 'ok') {
          expect(result.right.instance).toContain('universal-extractor-');
        }
      }
    });

    it('should persist extractor metadata to storage', async () => {
      const storage = createTestStorage();
      const result = await handler.initialize({}, storage)();
      expect(E.isRight(result)).toBe(true);
      if (E.isRight(result) && result.right.variant === 'ok') {
        const stored = await storage.get('extractors', result.right.instance);
        expect(stored).not.toBeNull();
        expect(stored!.instanceId).toBe(result.right.instance);
        const languages = stored!.supportedLanguages as string[];
        expect(languages).toContain('typescript');
        expect(languages).toContain('rust');
        expect(languages).toContain('python');
        expect(languages).toContain('go');
        expect(languages).toContain('swift');
        expect(languages).toContain('solidity');
      }
    });

    it('should collect all structural kinds across languages', async () => {
      const storage = createTestStorage();
      const result = await handler.initialize({}, storage)();
      expect(E.isRight(result)).toBe(true);
      if (E.isRight(result) && result.right.variant === 'ok') {
        const stored = await storage.get('extractors', result.right.instance);
        expect(stored).not.toBeNull();
        const kinds = stored!.structuralKinds as string[];
        expect(kinds).toContain('function');
        expect(kinds).toContain('class');
        expect(kinds).toContain('method');
        expect(kinds).toContain('interface');
        expect(kinds).toContain('struct');
      }
    });

    it('should persist per-language extraction configs', async () => {
      const storage = createTestStorage();
      const result = await handler.initialize({}, storage)();
      expect(E.isRight(result)).toBe(true);
      if (E.isRight(result) && result.right.variant === 'ok') {
        const instanceId = result.right.instance;
        const tsConfig = await storage.get('language_configs', `${instanceId}:typescript`);
        expect(tsConfig).not.toBeNull();
        expect(tsConfig!.language).toBe('typescript');
        expect(tsConfig!.nameField).toBe('name');
        const mappings = tsConfig!.mappings as Record<string, string>;
        expect(mappings['function_declaration']).toBe('function');
        expect(mappings['class_declaration']).toBe('class');
      }
    });

    it('should include extension map in metadata', async () => {
      const storage = createTestStorage();
      const result = await handler.initialize({}, storage)();
      expect(E.isRight(result)).toBe(true);
      if (E.isRight(result) && result.right.variant === 'ok') {
        const stored = await storage.get('extractors', result.right.instance);
        const extensionMap = stored!.extensionMap as Record<string, string>;
        expect(extensionMap['.ts']).toBe('typescript');
        expect(extensionMap['.rs']).toBe('rust');
        expect(extensionMap['.py']).toBe('python');
        expect(extensionMap['.sol']).toBe('solidity');
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
