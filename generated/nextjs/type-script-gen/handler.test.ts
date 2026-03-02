// TypeScriptGen — handler.test.ts
import { describe, it, expect } from 'vitest';
import * as TE from 'fp-ts/TaskEither';
import * as E from 'fp-ts/Either';
import { pipe } from 'fp-ts/function';

import { typeScriptGenHandler } from './handler.js';
import type { TypeScriptGenStorage } from './types.js';

const createTestStorage = (): TypeScriptGenStorage => {
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

const createFailingStorage = (): TypeScriptGenStorage => ({
  get: async () => { throw new Error('storage failure'); },
  put: async () => { throw new Error('storage failure'); },
  delete: async () => { throw new Error('storage failure'); },
  find: async () => { throw new Error('storage failure'); },
});

const handler = typeScriptGenHandler;

const validManifest = {
  name: 'todo',
  operations: [
    {
      name: 'create',
      input: [
        { name: 'title', type: 'string' },
        { name: 'done', type: 'boolean' },
      ],
      output: [
        {
          variant: 'ok',
          fields: [
            { name: 'id', type: 'string' },
            { name: 'title', type: 'string' },
          ],
        },
        {
          variant: 'error',
          fields: [
            { name: 'message', type: 'string' },
          ],
        },
      ],
    },
  ],
};

describe('TypeScriptGen handler', () => {
  describe('generate', () => {
    it('should generate types.ts and handler.ts for a valid manifest', async () => {
      const storage = createTestStorage();
      const result = await handler.generate(
        { spec: 'todo.concept', manifest: validManifest },
        storage,
      )();
      expect(E.isRight(result)).toBe(true);
      if (E.isRight(result)) {
        expect(result.right.variant).toBe('ok');
        if (result.right.variant === 'ok') {
          expect(result.right.files.length).toBe(2);
          const paths = result.right.files.map((f) => f.path);
          expect(paths).toContain('todo/types.ts');
          expect(paths).toContain('todo/handler.ts');
        }
      }
    });

    it('should include storage interface in generated types', async () => {
      const storage = createTestStorage();
      const result = await handler.generate(
        { spec: 'todo.concept', manifest: validManifest },
        storage,
      )();
      expect(E.isRight(result)).toBe(true);
      if (E.isRight(result) && result.right.variant === 'ok') {
        const typesFile = result.right.files.find((f) => f.path === 'todo/types.ts');
        expect(typesFile).toBeDefined();
        expect(typesFile!.content).toContain('TodoStorage');
        expect(typesFile!.content).toContain('TodoCreateInput');
        expect(typesFile!.content).toContain('TodoCreateOutputOk');
        expect(typesFile!.content).toContain('TodoCreateOutputError');
      }
    });

    it('should include variant constructors in generated types', async () => {
      const storage = createTestStorage();
      const result = await handler.generate(
        { spec: 'todo.concept', manifest: validManifest },
        storage,
      )();
      expect(E.isRight(result)).toBe(true);
      if (E.isRight(result) && result.right.variant === 'ok') {
        const typesFile = result.right.files.find((f) => f.path === 'todo/types.ts');
        expect(typesFile).toBeDefined();
        expect(typesFile!.content).toContain('Variant constructors');
      }
    });

    it('should return error for null manifest', async () => {
      const storage = createTestStorage();
      const result = await handler.generate(
        { spec: 'test.concept', manifest: null },
        storage,
      )();
      expect(E.isRight(result)).toBe(true);
      if (E.isRight(result)) {
        expect(result.right.variant).toBe('error');
      }
    });

    it('should return error for manifest without name', async () => {
      const storage = createTestStorage();
      const result = await handler.generate(
        { spec: 'test.concept', manifest: { operations: [] } },
        storage,
      )();
      expect(E.isRight(result)).toBe(true);
      if (E.isRight(result)) {
        expect(result.right.variant).toBe('error');
      }
    });

    it('should persist generation record to storage', async () => {
      const storage = createTestStorage();
      await handler.generate(
        { spec: 'todo.concept', manifest: validManifest },
        storage,
      )();
      const record = await storage.get('generated', 'todo.concept');
      expect(record).not.toBeNull();
      expect(record?.conceptName).toBe('todo');
      expect(record?.fileCount).toBe(2);
    });

    it('should return left on storage failure during persistence', async () => {
      const store = new Map<string, Map<string, Record<string, unknown>>>();
      const storage: TypeScriptGenStorage = {
        get: async (relation, key) => store.get(relation)?.get(key) ?? null,
        put: async () => { throw new Error('storage failure'); },
        delete: async (relation, key) => store.get(relation)?.delete(key) ?? false,
        find: async (relation) => [...(store.get(relation)?.values() ?? [])],
      };
      const result = await handler.generate(
        { spec: 'todo.concept', manifest: validManifest },
        storage,
      )();
      expect(E.isLeft(result)).toBe(true);
    });
  });

  describe('register', () => {
    it('should return registration metadata', async () => {
      const storage = createTestStorage();
      const result = await handler.register({}, storage)();
      expect(E.isRight(result)).toBe(true);
      if (E.isRight(result)) {
        expect(result.right.variant).toBe('ok');
        expect(result.right.name).toBe('typescript-gen');
        expect(result.right.inputKind).toBe('concept-ast');
        expect(result.right.outputKind).toBe('typescript');
        expect(result.right.capabilities).toContain('types');
        expect(result.right.capabilities).toContain('fp-ts-integration');
      }
    });
  });
});
