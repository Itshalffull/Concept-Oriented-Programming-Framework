// SyncScaffoldGen — handler.test.ts
import { describe, it, expect } from 'vitest';
import * as TE from 'fp-ts/TaskEither';
import * as E from 'fp-ts/Either';
import { pipe } from 'fp-ts/function';

import { syncScaffoldGenHandler } from './handler.js';
import type { SyncScaffoldGenStorage } from './types.js';

const createTestStorage = (): SyncScaffoldGenStorage => {
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

const createFailingStorage = (): SyncScaffoldGenStorage => ({
  get: async () => { throw new Error('storage failure'); },
  put: async () => { throw new Error('storage failure'); },
  delete: async () => { throw new Error('storage failure'); },
  find: async () => { throw new Error('storage failure'); },
});

const handler = syncScaffoldGenHandler;

describe('SyncScaffoldGen handler', () => {
  describe('generate', () => {
    it('should generate scaffold files for a sync rule', async () => {
      const storage = createTestStorage();
      const result = await handler.generate(
        {
          name: 'user-to-profile',
          trigger: { name: 'UserCreated' },
          effects: [{ name: 'create-profile' }, { name: 'send-welcome' }],
        },
        storage,
      )();
      expect(E.isRight(result)).toBe(true);
      if (E.isRight(result)) {
        expect(result.right.variant).toBe('ok');
        if (result.right.variant === 'ok') {
          expect(result.right.filesGenerated).toBeGreaterThanOrEqual(4);
          const paths = result.right.files.map((f) => (f as Record<string, unknown>).path);
          expect(paths).toContain('sync/user-to-profile/sync.yaml');
          expect(paths).toContain('sync/user-to-profile/trigger.ts');
          expect(paths).toContain('sync/user-to-profile/index.ts');
        }
      }
    });

    it('should generate per-effect handler stubs', async () => {
      const storage = createTestStorage();
      const result = await handler.generate(
        {
          name: 'my-sync',
          trigger: 'OnChange',
          effects: ['notify', 'log'],
        },
        storage,
      )();
      expect(E.isRight(result)).toBe(true);
      if (E.isRight(result) && result.right.variant === 'ok') {
        const paths = result.right.files.map((f) => (f as Record<string, unknown>).path);
        expect(paths).toContain('sync/my-sync/effects/notify.handler.ts');
        expect(paths).toContain('sync/my-sync/effects/log.handler.ts');
      }
    });

    it('should return error for empty name', async () => {
      const storage = createTestStorage();
      const result = await handler.generate(
        { name: '', trigger: 'x', effects: ['y'] },
        storage,
      )();
      expect(E.isRight(result)).toBe(true);
      if (E.isRight(result)) {
        expect(result.right.variant).toBe('error');
      }
    });

    it('should return error for whitespace-only name', async () => {
      const storage = createTestStorage();
      const result = await handler.generate(
        { name: '   ', trigger: 'x', effects: ['y'] },
        storage,
      )();
      expect(E.isRight(result)).toBe(true);
      if (E.isRight(result)) {
        expect(result.right.variant).toBe('error');
      }
    });

    it('should persist scaffold to storage', async () => {
      const storage = createTestStorage();
      await handler.generate(
        { name: 'my-sync', trigger: 'OnChange', effects: ['notify'] },
        storage,
      )();
      const stored = await storage.get('scaffolds', 'my-sync');
      expect(stored).not.toBeNull();
      expect(stored?.name).toBe('my-sync');
    });

    it('should return Left on storage failure', async () => {
      const storage = createFailingStorage();
      const result = await handler.generate(
        { name: 'my-sync', trigger: 'OnChange', effects: ['notify'] },
        storage,
      )();
      expect(E.isLeft(result)).toBe(true);
    });
  });

  describe('preview', () => {
    it('should preview files without persisting', async () => {
      const storage = createTestStorage();
      const result = await handler.preview(
        { name: 'my-sync', trigger: 'OnChange', effects: ['notify'] },
        storage,
      )();
      expect(E.isRight(result)).toBe(true);
      if (E.isRight(result)) {
        expect(result.right.variant).toBe('ok');
        if (result.right.variant === 'ok') {
          expect(result.right.wouldWrite).toBeGreaterThan(0);
        }
      }
    });

    it('should return cached when identical scaffold already exists', async () => {
      const storage = createTestStorage();
      await handler.generate(
        { name: 'my-sync', trigger: 'OnChange', effects: ['notify'] },
        storage,
      )();
      const result = await handler.preview(
        { name: 'my-sync', trigger: 'OnChange', effects: ['notify'] },
        storage,
      )();
      expect(E.isRight(result)).toBe(true);
      if (E.isRight(result)) {
        expect(result.right.variant).toBe('cached');
      }
    });

    it('should return error for empty name', async () => {
      const storage = createTestStorage();
      const result = await handler.preview(
        { name: '', trigger: 'x', effects: ['y'] },
        storage,
      )();
      expect(E.isRight(result)).toBe(true);
      if (E.isRight(result)) {
        expect(result.right.variant).toBe('error');
      }
    });
  });

  describe('register', () => {
    it('should return registration info', async () => {
      const storage = createTestStorage();
      const result = await handler.register({}, storage)();
      expect(E.isRight(result)).toBe(true);
      if (E.isRight(result)) {
        expect(result.right.variant).toBe('ok');
        expect(result.right.name).toBe('sync-scaffold-gen');
        expect(result.right.capabilities).toContain('generate');
        expect(result.right.capabilities).toContain('preview');
      }
    });
  });
});
