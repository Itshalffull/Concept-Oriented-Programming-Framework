// LanguageGrammar — handler.test.ts
import { describe, it, expect } from 'vitest';
import * as TE from 'fp-ts/TaskEither';
import * as E from 'fp-ts/Either';
import { pipe } from 'fp-ts/function';

import { languageGrammarHandler } from './handler.js';
import type { LanguageGrammarStorage } from './types.js';

const createTestStorage = (): LanguageGrammarStorage => {
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

const createFailingStorage = (): LanguageGrammarStorage => ({
  get: async () => { throw new Error('storage failure'); },
  put: async () => { throw new Error('storage failure'); },
  delete: async () => { throw new Error('storage failure'); },
  find: async () => { throw new Error('storage failure'); },
});

const handler = languageGrammarHandler;

describe('LanguageGrammar handler', () => {
  describe('register', () => {
    it('should register a new grammar and return ok', async () => {
      const storage = createTestStorage();
      const result = await handler.register(
        {
          name: 'typescript',
          extensions: JSON.stringify(['.ts', '.tsx']),
          parserWasmPath: '/parsers/typescript.wasm',
          nodeTypes: 'ts-node-types.json',
        },
        storage,
      )();
      expect(E.isRight(result)).toBe(true);
      if (E.isRight(result)) {
        expect(result.right.variant).toBe('ok');
        if (result.right.variant === 'ok') {
          expect(result.right.grammar).toBe('typescript');
        }
      }
    });

    it('should return alreadyRegistered when grammar name exists', async () => {
      const storage = createTestStorage();
      await handler.register(
        {
          name: 'typescript',
          extensions: JSON.stringify(['.ts']),
          parserWasmPath: '/parsers/typescript.wasm',
          nodeTypes: 'ts-node-types.json',
        },
        storage,
      )();
      const result = await handler.register(
        {
          name: 'typescript',
          extensions: JSON.stringify(['.ts']),
          parserWasmPath: '/parsers/typescript2.wasm',
          nodeTypes: 'ts-node-types2.json',
        },
        storage,
      )();
      expect(E.isRight(result)).toBe(true);
      if (E.isRight(result)) {
        expect(result.right.variant).toBe('alreadyRegistered');
      }
    });

    it('should index extensions for reverse lookup', async () => {
      const storage = createTestStorage();
      await handler.register(
        {
          name: 'javascript',
          extensions: JSON.stringify(['.js', '.mjs']),
          parserWasmPath: '/parsers/javascript.wasm',
          nodeTypes: 'js-node-types.json',
        },
        storage,
      )();
      const resolveResult = await handler.resolve({ fileExtension: '.js' }, storage)();
      expect(E.isRight(resolveResult)).toBe(true);
      if (E.isRight(resolveResult)) {
        expect(resolveResult.right.variant).toBe('ok');
        if (resolveResult.right.variant === 'ok') {
          expect(resolveResult.right.grammar).toBe('javascript');
        }
      }
    });

    it('should return left on storage failure', async () => {
      const storage = createFailingStorage();
      const result = await handler.register(
        {
          name: 'rust',
          extensions: JSON.stringify(['.rs']),
          parserWasmPath: '/parsers/rust.wasm',
          nodeTypes: 'rust-node-types.json',
        },
        storage,
      )();
      expect(E.isLeft(result)).toBe(true);
    });
  });

  describe('resolve', () => {
    it('should resolve a grammar by file extension', async () => {
      const storage = createTestStorage();
      await handler.register(
        {
          name: 'python',
          extensions: JSON.stringify(['.py', '.pyi']),
          parserWasmPath: '/parsers/python.wasm',
          nodeTypes: 'py-node-types.json',
        },
        storage,
      )();
      const result = await handler.resolve({ fileExtension: '.py' }, storage)();
      expect(E.isRight(result)).toBe(true);
      if (E.isRight(result)) {
        expect(result.right.variant).toBe('ok');
        if (result.right.variant === 'ok') {
          expect(result.right.grammar).toBe('python');
        }
      }
    });

    it('should return noGrammar for unknown extension', async () => {
      const storage = createTestStorage();
      const result = await handler.resolve({ fileExtension: '.xyz' }, storage)();
      expect(E.isRight(result)).toBe(true);
      if (E.isRight(result)) {
        expect(result.right.variant).toBe('noGrammar');
        if (result.right.variant === 'noGrammar') {
          expect(result.right.extension).toBe('.xyz');
        }
      }
    });
  });

  describe('resolveByMime', () => {
    it('should resolve grammar by known MIME type when grammar is registered', async () => {
      const storage = createTestStorage();
      await handler.register(
        {
          name: 'javascript',
          extensions: JSON.stringify(['.js']),
          parserWasmPath: '/parsers/js.wasm',
          nodeTypes: 'js-types.json',
        },
        storage,
      )();
      const result = await handler.resolveByMime({ mimeType: 'text/javascript' }, storage)();
      expect(E.isRight(result)).toBe(true);
      if (E.isRight(result)) {
        expect(result.right.variant).toBe('ok');
        if (result.right.variant === 'ok') {
          expect(result.right.grammar).toBe('javascript');
        }
      }
    });

    it('should return noGrammar for unknown MIME type', async () => {
      const storage = createTestStorage();
      const result = await handler.resolveByMime({ mimeType: 'application/octet-stream' }, storage)();
      expect(E.isRight(result)).toBe(true);
      if (E.isRight(result)) {
        expect(result.right.variant).toBe('noGrammar');
      }
    });

    it('should return noGrammar when MIME maps to language but grammar not registered', async () => {
      const storage = createTestStorage();
      const result = await handler.resolveByMime({ mimeType: 'text/x-python' }, storage)();
      expect(E.isRight(result)).toBe(true);
      if (E.isRight(result)) {
        expect(result.right.variant).toBe('noGrammar');
      }
    });
  });

  describe('get', () => {
    it('should get a registered grammar by name', async () => {
      const storage = createTestStorage();
      await handler.register(
        {
          name: 'go',
          extensions: JSON.stringify(['.go']),
          parserWasmPath: '/parsers/go.wasm',
          nodeTypes: 'go-types.json',
        },
        storage,
      )();
      const result = await handler.get({ grammar: 'go' }, storage)();
      expect(E.isRight(result)).toBe(true);
      if (E.isRight(result)) {
        expect(result.right.variant).toBe('ok');
        if (result.right.variant === 'ok') {
          expect(result.right.name).toBe('go');
          expect(result.right.parserWasmPath).toBe('/parsers/go.wasm');
        }
      }
    });

    it('should return notfound for unregistered grammar', async () => {
      const storage = createTestStorage();
      const result = await handler.get({ grammar: 'nonexistent' }, storage)();
      expect(E.isRight(result)).toBe(true);
      if (E.isRight(result)) {
        expect(result.right.variant).toBe('notfound');
      }
    });
  });

  describe('list', () => {
    it('should list all registered grammars', async () => {
      const storage = createTestStorage();
      await handler.register(
        {
          name: 'rust',
          extensions: JSON.stringify(['.rs']),
          parserWasmPath: '/parsers/rust.wasm',
          nodeTypes: 'rust-types.json',
        },
        storage,
      )();
      await handler.register(
        {
          name: 'go',
          extensions: JSON.stringify(['.go']),
          parserWasmPath: '/parsers/go.wasm',
          nodeTypes: 'go-types.json',
        },
        storage,
      )();
      const result = await handler.list({}, storage)();
      expect(E.isRight(result)).toBe(true);
      if (E.isRight(result)) {
        expect(result.right.variant).toBe('ok');
        const grammars = JSON.parse(result.right.grammars);
        expect(grammars).toHaveLength(2);
      }
    });

    it('should return empty list when no grammars registered', async () => {
      const storage = createTestStorage();
      const result = await handler.list({}, storage)();
      expect(E.isRight(result)).toBe(true);
      if (E.isRight(result)) {
        expect(result.right.variant).toBe('ok');
        const grammars = JSON.parse(result.right.grammars);
        expect(grammars).toHaveLength(0);
      }
    });
  });
});
