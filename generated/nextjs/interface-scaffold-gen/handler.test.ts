// InterfaceScaffoldGen — handler.test.ts
// Unit tests for interfaceScaffoldGen handler actions.

import { describe, it, expect } from 'vitest';
import * as TE from 'fp-ts/TaskEither';
import * as E from 'fp-ts/Either';
import { pipe } from 'fp-ts/function';

import { interfaceScaffoldGenHandler } from './handler.js';
import type { InterfaceScaffoldGenStorage } from './types.js';

const createTestStorage = (): InterfaceScaffoldGenStorage => {
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

const createFailingStorage = (): InterfaceScaffoldGenStorage => ({
  get: async () => { throw new Error('storage failure'); },
  put: async () => { throw new Error('storage failure'); },
  delete: async () => { throw new Error('storage failure'); },
  find: async () => { throw new Error('storage failure'); },
});

describe('InterfaceScaffoldGen handler', () => {
  describe('generate', () => {
    it('should generate interface scaffold files', async () => {
      const storage = createTestStorage();
      const input = {
        name: 'user-api',
        targets: ['rest', 'graphql'],
        sdks: ['typescript'],
      };

      const result = await interfaceScaffoldGenHandler.generate(input, storage)();
      expect(E.isRight(result)).toBe(true);
      if (E.isRight(result)) {
        expect(result.right.variant).toBe('ok');
        if (result.right.variant === 'ok') {
          // 1 manifest + 2 target bindings + 1 sdk config + 1 barrel = 5
          expect(result.right.filesGenerated).toBe(5);
        }
      }
    });

    it('should return error for empty name', async () => {
      const storage = createTestStorage();
      const input = { name: '', targets: ['rest'], sdks: ['typescript'] };

      const result = await interfaceScaffoldGenHandler.generate(input, storage)();
      expect(E.isRight(result)).toBe(true);
      if (E.isRight(result)) {
        expect(result.right.variant).toBe('error');
      }
    });

    it('should return error for empty targets', async () => {
      const storage = createTestStorage();
      const input = { name: 'test', targets: [] as string[], sdks: ['typescript'] };

      const result = await interfaceScaffoldGenHandler.generate(input, storage)();
      expect(E.isRight(result)).toBe(true);
      if (E.isRight(result)) {
        expect(result.right.variant).toBe('error');
      }
    });

    it('should return left on storage failure', async () => {
      const storage = createFailingStorage();
      const input = { name: 'test', targets: ['rest'], sdks: ['ts'] };
      const result = await interfaceScaffoldGenHandler.generate(input, storage)();
      expect(E.isLeft(result)).toBe(true);
    });
  });

  describe('preview', () => {
    it('should preview files for a new interface', async () => {
      const storage = createTestStorage();
      const input = {
        name: 'new-api',
        targets: ['rest'],
        sdks: ['python'],
      };

      const result = await interfaceScaffoldGenHandler.preview(input, storage)();
      expect(E.isRight(result)).toBe(true);
      if (E.isRight(result)) {
        expect(result.right.variant).toBe('ok');
        if (result.right.variant === 'ok') {
          expect(result.right.wouldWrite).toBeGreaterThan(0);
          expect(result.right.wouldSkip).toBe(0);
        }
      }
    });

    it('should return cached when all files already exist', async () => {
      const storage = createTestStorage();
      const input = {
        name: 'cached-api',
        targets: ['rest'],
        sdks: ['typescript'],
      };

      await interfaceScaffoldGenHandler.generate(input, storage)();
      const result = await interfaceScaffoldGenHandler.preview(input, storage)();
      expect(E.isRight(result)).toBe(true);
      if (E.isRight(result)) {
        expect(result.right.variant).toBe('cached');
      }
    });

    it('should return error for empty name', async () => {
      const storage = createTestStorage();
      const input = { name: '  ', targets: ['rest'], sdks: [] as string[] };

      const result = await interfaceScaffoldGenHandler.preview(input, storage)();
      expect(E.isRight(result)).toBe(true);
      if (E.isRight(result)) {
        expect(result.right.variant).toBe('error');
      }
    });

    it('should return left on storage failure', async () => {
      const storage = createFailingStorage();
      const input = { name: 'test', targets: ['rest'], sdks: ['ts'] };
      const result = await interfaceScaffoldGenHandler.preview(input, storage)();
      expect(E.isLeft(result)).toBe(true);
    });
  });

  describe('register', () => {
    it('should return registration metadata', async () => {
      const storage = createTestStorage();
      const input = {};

      const result = await interfaceScaffoldGenHandler.register(input, storage)();
      expect(E.isRight(result)).toBe(true);
      if (E.isRight(result)) {
        expect(result.right.variant).toBe('ok');
        expect(result.right.name).toBe('interface-scaffold-gen');
        expect(result.right.capabilities).toContain('generate');
        expect(result.right.capabilities).toContain('preview');
      }
    });
  });
});
