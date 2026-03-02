// SyncParser — handler.test.ts
import { describe, it, expect } from 'vitest';
import * as TE from 'fp-ts/TaskEither';
import * as E from 'fp-ts/Either';
import { pipe } from 'fp-ts/function';

import { syncParserHandler } from './handler.js';
import type { SyncParserStorage } from './types.js';

const createTestStorage = (): SyncParserStorage => {
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

const createFailingStorage = (): SyncParserStorage => ({
  get: async () => { throw new Error('storage failure'); },
  put: async () => { throw new Error('storage failure'); },
  delete: async () => { throw new Error('storage failure'); },
  find: async () => { throw new Error('storage failure'); },
});

const handler = syncParserHandler;

const validSource = `
sync user-to-profile
on User.create:ok
where status == active
do Profile.create
`;

describe('SyncParser handler', () => {
  describe('parse', () => {
    it('should parse a valid sync source', async () => {
      const storage = createTestStorage();
      const result = await handler.parse(
        { source: validSource, manifests: [] },
        storage,
      )();
      expect(E.isRight(result)).toBe(true);
      if (E.isRight(result)) {
        expect(result.right.variant).toBe('ok');
        if (result.right.variant === 'ok') {
          expect(result.right.sync).toContain('sync-');
          const ast = result.right.ast as Record<string, unknown>;
          expect(ast.type).toBe('sync');
          expect(ast.name).toBe('user-to-profile');
        }
      }
    });

    it('should parse trigger with concept and action', async () => {
      const storage = createTestStorage();
      const result = await handler.parse(
        { source: validSource, manifests: [] },
        storage,
      )();
      expect(E.isRight(result)).toBe(true);
      if (E.isRight(result) && result.right.variant === 'ok') {
        const ast = result.right.ast as Record<string, unknown>;
        const trigger = ast.trigger as Record<string, unknown>;
        expect(trigger.concept).toBe('User');
        expect(trigger.action).toBe('create');
        expect(trigger.variant).toBe('ok');
      }
    });

    it('should parse where-guard clauses', async () => {
      const storage = createTestStorage();
      const result = await handler.parse(
        { source: validSource, manifests: [] },
        storage,
      )();
      expect(E.isRight(result)).toBe(true);
      if (E.isRight(result) && result.right.variant === 'ok') {
        const ast = result.right.ast as Record<string, unknown>;
        const where = ast.where as readonly Record<string, unknown>[];
        expect(where).toBeDefined();
        expect(where.length).toBe(1);
        expect(where[0].field).toBe('status');
        expect(where[0].operator).toBe('==');
        expect(where[0].value).toBe('active');
      }
    });

    it('should parse do-effect clauses', async () => {
      const storage = createTestStorage();
      const result = await handler.parse(
        { source: validSource, manifests: [] },
        storage,
      )();
      expect(E.isRight(result)).toBe(true);
      if (E.isRight(result) && result.right.variant === 'ok') {
        const ast = result.right.ast as Record<string, unknown>;
        const effects = ast.effects as readonly Record<string, unknown>[];
        expect(effects.length).toBe(1);
        expect(effects[0].concept).toBe('Profile');
        expect(effects[0].action).toBe('create');
      }
    });

    it('should return error for empty source', async () => {
      const storage = createTestStorage();
      const result = await handler.parse(
        { source: '', manifests: [] },
        storage,
      )();
      expect(E.isRight(result)).toBe(true);
      if (E.isRight(result)) {
        expect(result.right.variant).toBe('error');
        if (result.right.variant === 'error') {
          expect(result.right.message).toContain('empty');
        }
      }
    });

    it('should return error for missing sync declaration', async () => {
      const storage = createTestStorage();
      const result = await handler.parse(
        { source: 'on User.create\ndo Profile.create', manifests: [] },
        storage,
      )();
      expect(E.isRight(result)).toBe(true);
      if (E.isRight(result)) {
        expect(result.right.variant).toBe('error');
        if (result.right.variant === 'error') {
          expect(result.right.message).toContain('sync declaration');
        }
      }
    });

    it('should return error for missing on-trigger', async () => {
      const storage = createTestStorage();
      const result = await handler.parse(
        { source: 'sync my-rule\ndo Profile.create', manifests: [] },
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

    it('should return error for invalid trigger format', async () => {
      const storage = createTestStorage();
      const result = await handler.parse(
        { source: 'sync my-rule\non invalid-trigger\ndo Profile.create', manifests: [] },
        storage,
      )();
      expect(E.isRight(result)).toBe(true);
      if (E.isRight(result)) {
        expect(result.right.variant).toBe('error');
        if (result.right.variant === 'error') {
          expect(result.right.message).toContain('trigger format');
        }
      }
    });

    it('should return error for missing do-effects', async () => {
      const storage = createTestStorage();
      const result = await handler.parse(
        { source: 'sync my-rule\non User.create', manifests: [] },
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

    it('should ignore comments and blank lines', async () => {
      const storage = createTestStorage();
      const source = `
# This is a comment
// This is also a comment

sync my-sync
on User.create
do Profile.create
`;
      const result = await handler.parse({ source, manifests: [] }, storage)();
      expect(E.isRight(result)).toBe(true);
      if (E.isRight(result)) {
        expect(result.right.variant).toBe('ok');
      }
    });

    it('should persist parsed sync to storage', async () => {
      const storage = createTestStorage();
      await handler.parse({ source: validSource, manifests: [] }, storage)();
      const stored = await storage.find('parsed_syncs');
      expect(stored.length).toBe(1);
    });

    it('should return Left on storage failure', async () => {
      const storage = createFailingStorage();
      const result = await handler.parse(
        { source: validSource, manifests: [] },
        storage,
      )();
      expect(E.isLeft(result)).toBe(true);
    });
  });
});
