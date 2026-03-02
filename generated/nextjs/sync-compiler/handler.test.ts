// SyncCompiler — handler.test.ts
import { describe, it, expect } from 'vitest';
import * as TE from 'fp-ts/TaskEither';
import * as E from 'fp-ts/Either';
import { pipe } from 'fp-ts/function';

import { syncCompilerHandler } from './handler.js';
import type { SyncCompilerStorage } from './types.js';

const createTestStorage = (): SyncCompilerStorage => {
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

const createFailingStorage = (): SyncCompilerStorage => ({
  get: async () => { throw new Error('storage failure'); },
  put: async () => { throw new Error('storage failure'); },
  delete: async () => { throw new Error('storage failure'); },
  find: async () => { throw new Error('storage failure'); },
});

const handler = syncCompilerHandler;

const validAST = {
  type: 'sync',
  name: 'user-to-profile',
  trigger: {
    concept: 'user',
    action: 'create',
    variant: 'ok',
  },
  effects: [
    {
      concept: 'profile',
      action: 'create',
      mappings: { name: '$trigger.name' },
    },
  ],
  where: [
    { field: 'status', operator: '==', value: 'active' },
  ],
};

describe('SyncCompiler handler', () => {
  describe('compile', () => {
    it('should compile a valid sync AST', async () => {
      const storage = createTestStorage();
      const result = await handler.compile(
        { sync: 'user-to-profile', ast: validAST },
        storage,
      )();
      expect(E.isRight(result)).toBe(true);
      if (E.isRight(result)) {
        expect(result.right.variant).toBe('ok');
        if (result.right.variant === 'ok') {
          const compiled = result.right.compiled as Record<string, unknown>;
          expect(compiled.syncName).toBe('user-to-profile');
          expect(compiled.trigger).toBeDefined();
          expect((compiled.trigger as Record<string, unknown>).conceptUri).toBe('clef://user');
        }
      }
    });

    it('should return error when trigger is missing', async () => {
      const storage = createTestStorage();
      const result = await handler.compile(
        { sync: 'bad-sync', ast: { effects: [{ concept: 'a', action: 'b' }] } },
        storage,
      )();
      expect(E.isRight(result)).toBe(true);
      if (E.isRight(result)) {
        expect(result.right.variant).toBe('error');
        if (result.right.variant === 'error') {
          expect(result.right.message).toContain('trigger');
        }
      }
    });

    it('should return error when trigger concept is empty', async () => {
      const storage = createTestStorage();
      const result = await handler.compile(
        {
          sync: 'bad-sync',
          ast: {
            trigger: { concept: '', action: 'create' },
            effects: [{ concept: 'a', action: 'b' }],
          },
        },
        storage,
      )();
      expect(E.isRight(result)).toBe(true);
      if (E.isRight(result)) {
        expect(result.right.variant).toBe('error');
      }
    });

    it('should return error when effects are missing', async () => {
      const storage = createTestStorage();
      const result = await handler.compile(
        {
          sync: 'bad-sync',
          ast: { trigger: { concept: 'user', action: 'create' }, effects: [] },
        },
        storage,
      )();
      expect(E.isRight(result)).toBe(true);
      if (E.isRight(result)) {
        expect(result.right.variant).toBe('error');
        if (result.right.variant === 'error') {
          expect(result.right.message).toContain('effect');
        }
      }
    });

    it('should return error when effect concept is empty', async () => {
      const storage = createTestStorage();
      const result = await handler.compile(
        {
          sync: 'bad-sync',
          ast: {
            trigger: { concept: 'user', action: 'create' },
            effects: [{ concept: '', action: 'do' }],
          },
        },
        storage,
      )();
      expect(E.isRight(result)).toBe(true);
      if (E.isRight(result)) {
        expect(result.right.variant).toBe('error');
      }
    });

    it('should include guards in compiled output', async () => {
      const storage = createTestStorage();
      const result = await handler.compile(
        { sync: 'user-to-profile', ast: validAST },
        storage,
      )();
      expect(E.isRight(result)).toBe(true);
      if (E.isRight(result) && result.right.variant === 'ok') {
        const compiled = result.right.compiled as Record<string, unknown>;
        const guards = compiled.guards as readonly unknown[];
        expect(guards.length).toBe(1);
      }
    });

    it('should persist compiled sync to storage', async () => {
      const storage = createTestStorage();
      await handler.compile(
        { sync: 'user-to-profile', ast: validAST },
        storage,
      )();
      const stored = await storage.find('compiled_syncs');
      expect(stored.length).toBe(1);
    });

    it('should return Left on storage failure', async () => {
      const storage = createFailingStorage();
      const result = await handler.compile(
        { sync: 'user-to-profile', ast: validAST },
        storage,
      )();
      expect(E.isLeft(result)).toBe(true);
    });
  });
});
