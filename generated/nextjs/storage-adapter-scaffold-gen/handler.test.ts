// StorageAdapterScaffoldGen — handler.test.ts
import { describe, it, expect } from 'vitest';
import * as TE from 'fp-ts/TaskEither';
import * as E from 'fp-ts/Either';
import { pipe } from 'fp-ts/function';

import { storageAdapterScaffoldGenHandler } from './handler.js';
import type { StorageAdapterScaffoldGenStorage } from './types.js';

const createTestStorage = (): StorageAdapterScaffoldGenStorage => {
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

const createFailingStorage = (): StorageAdapterScaffoldGenStorage => ({
  get: async () => { throw new Error('storage failure'); },
  put: async () => { throw new Error('storage failure'); },
  delete: async () => { throw new Error('storage failure'); },
  find: async () => { throw new Error('storage failure'); },
});

const handler = storageAdapterScaffoldGenHandler;

describe('StorageAdapterScaffoldGen handler', () => {
  describe('register', () => {
    it('should return registration metadata', async () => {
      const storage = createTestStorage();
      const result = await handler.register({}, storage)();
      expect(E.isRight(result)).toBe(true);
      if (E.isRight(result)) {
        expect(result.right.variant).toBe('ok');
        expect(result.right.name).toBe('storage-adapter-scaffold-gen');
        expect(result.right.capabilities).toContain('generate');
        expect(result.right.capabilities).toContain('preview');
      }
    });
  });

  describe('generate', () => {
    it('should generate adapter files for postgres backend', async () => {
      const storage = createTestStorage();
      const result = await handler.generate(
        { name: 'my-postgres-adapter', backend: 'postgres' },
        storage,
      )();
      expect(E.isRight(result)).toBe(true);
      if (E.isRight(result)) {
        expect(result.right.variant).toBe('ok');
        if (result.right.variant === 'ok') {
          expect(result.right.filesGenerated).toBe(3);
          expect(result.right.files.length).toBe(3);
          const paths = result.right.files.map((f: any) => f.path);
          expect(paths).toContain('adapters/my-postgres-adapter/adapter.ts');
          expect(paths).toContain('adapters/my-postgres-adapter/config.ts');
          expect(paths).toContain('adapters/my-postgres-adapter/index.ts');
        }
      }
    });

    it('should include driver reference in generated adapter', async () => {
      const storage = createTestStorage();
      const result = await handler.generate(
        { name: 'sqlite-adapter', backend: 'sqlite' },
        storage,
      )();
      expect(E.isRight(result)).toBe(true);
      if (E.isRight(result) && result.right.variant === 'ok') {
        const adapterFile = result.right.files.find((f: any) => (f as Record<string, unknown>).kind === 'adapter') as Record<string, unknown> | undefined;
        expect(adapterFile).toBeDefined();
        expect(String(adapterFile!.content)).toContain('better-sqlite3');
      }
    });

    it('should return error for empty name', async () => {
      const storage = createTestStorage();
      const result = await handler.generate(
        { name: '', backend: 'postgres' },
        storage,
      )();
      expect(E.isRight(result)).toBe(true);
      if (E.isRight(result)) {
        expect(result.right.variant).toBe('error');
      }
    });

    it('should return error for empty backend', async () => {
      const storage = createTestStorage();
      const result = await handler.generate(
        { name: 'test-adapter', backend: '' },
        storage,
      )();
      expect(E.isRight(result)).toBe(true);
      if (E.isRight(result)) {
        expect(result.right.variant).toBe('error');
      }
    });

    it('should persist scaffold record in storage', async () => {
      const storage = createTestStorage();
      await handler.generate(
        { name: 'persisted-adapter', backend: 'redis' },
        storage,
      )();
      const record = await storage.get('scaffolds', 'persisted-adapter');
      expect(record).not.toBeNull();
      expect(record!['backend']).toBe('redis');
    });

    it('should generate for memory backend', async () => {
      const storage = createTestStorage();
      const result = await handler.generate(
        { name: 'mem-adapter', backend: 'memory' },
        storage,
      )();
      expect(E.isRight(result)).toBe(true);
      if (E.isRight(result) && result.right.variant === 'ok') {
        const adapterFile = result.right.files.find((f: any) => (f as Record<string, unknown>).kind === 'adapter') as Record<string, unknown> | undefined;
        expect(String(adapterFile!.content)).toContain('(built-in)');
      }
    });
  });

  describe('preview', () => {
    it('should preview files that would be generated', async () => {
      const storage = createTestStorage();
      const result = await handler.preview(
        { name: 'preview-adapter', backend: 'postgres' },
        storage,
      )();
      expect(E.isRight(result)).toBe(true);
      if (E.isRight(result)) {
        expect(result.right.variant).toBe('ok');
        if (result.right.variant === 'ok') {
          expect(result.right.wouldWrite).toBe(3);
          expect(result.right.wouldSkip).toBe(0);
        }
      }
    });

    it('should return cached when all files already exist', async () => {
      const storage = createTestStorage();
      await handler.generate({ name: 'cached-adapter', backend: 'postgres' }, storage)();
      const result = await handler.preview(
        { name: 'cached-adapter', backend: 'postgres' },
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
        { name: '', backend: 'postgres' },
        storage,
      )();
      expect(E.isRight(result)).toBe(true);
      if (E.isRight(result)) {
        expect(result.right.variant).toBe('error');
      }
    });
  });
});
