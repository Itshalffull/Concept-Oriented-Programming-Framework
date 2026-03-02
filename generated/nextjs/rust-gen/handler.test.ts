// RustGen — handler.test.ts
import { describe, it, expect } from 'vitest';
import * as TE from 'fp-ts/TaskEither';
import * as E from 'fp-ts/Either';
import { pipe } from 'fp-ts/function';

import { rustGenHandler } from './handler.js';
import type { RustGenStorage } from './types.js';

const createTestStorage = (): RustGenStorage => {
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

const createFailingStorage = (): RustGenStorage => ({
  get: async () => { throw new Error('storage failure'); },
  put: async () => { throw new Error('storage failure'); },
  delete: async () => { throw new Error('storage failure'); },
  find: async () => { throw new Error('storage failure'); },
});

const handler = rustGenHandler;

describe('RustGen handler', () => {
  describe('generate', () => {
    it('should generate Rust files from a valid manifest', async () => {
      const storage = createTestStorage();
      const manifest = {
        name: 'order',
        operations: [
          {
            name: 'create',
            input: [{ name: 'title', type: 'string' }, { name: 'amount', type: 'number' }],
            output: [{ variant: 'ok', fields: [{ name: 'id', type: 'string' }] }],
          },
        ],
      };
      const result = await handler.generate({ spec: 'order.concept', manifest }, storage)();
      expect(E.isRight(result)).toBe(true);
      if (E.isRight(result)) {
        expect(result.right.variant).toBe('ok');
        if (result.right.variant === 'ok') {
          expect(result.right.files.length).toBe(3); // types.rs, handler.rs, mod.rs
          expect(result.right.files.some(f => f.path.endsWith('types.rs'))).toBe(true);
          expect(result.right.files.some(f => f.path.endsWith('handler.rs'))).toBe(true);
          expect(result.right.files.some(f => f.path.endsWith('mod.rs'))).toBe(true);
        }
      }
    });

    it('should return error for invalid manifest', async () => {
      const storage = createTestStorage();
      const result = await handler.generate({ spec: 'bad.concept', manifest: null }, storage)();
      expect(E.isRight(result)).toBe(true);
      if (E.isRight(result)) {
        expect(result.right.variant).toBe('error');
      }
    });

    it('should return error for manifest without name', async () => {
      const storage = createTestStorage();
      const result = await handler.generate({ spec: 'bad.concept', manifest: { operations: [] } }, storage)();
      expect(E.isRight(result)).toBe(true);
      if (E.isRight(result)) {
        expect(result.right.variant).toBe('error');
      }
    });

    it('should generate correct type mappings in content', async () => {
      const storage = createTestStorage();
      const manifest = {
        name: 'user',
        operations: [
          {
            name: 'get',
            input: [{ name: 'id', type: 'integer' }, { name: 'active', type: 'boolean' }],
            output: [{ variant: 'ok', fields: [{ name: 'data', type: 'object' }] }],
          },
        ],
      };
      const result = await handler.generate({ spec: 'user.concept', manifest }, storage)();
      expect(E.isRight(result)).toBe(true);
      if (E.isRight(result) && result.right.variant === 'ok') {
        const typesFile = result.right.files.find(f => f.path.endsWith('types.rs'));
        expect(typesFile).toBeTruthy();
        expect(typesFile!.content).toContain('i64');
        expect(typesFile!.content).toContain('bool');
      }
    });
  });

  describe('register', () => {
    it('should return generator registration info', async () => {
      const storage = createTestStorage();
      const result = await handler.register({}, storage)();
      expect(E.isRight(result)).toBe(true);
      if (E.isRight(result)) {
        expect(result.right.variant).toBe('ok');
        expect(result.right.name).toBe('rust-gen');
        expect(result.right.inputKind).toBe('concept-ast');
        expect(result.right.outputKind).toBe('rust');
        expect(result.right.capabilities.length).toBeGreaterThan(0);
      }
    });
  });
});
