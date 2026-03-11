// ProjectScaffold — handler.test.ts
import { describe, it, expect } from 'vitest';
import * as TE from 'fp-ts/TaskEither';
import * as E from 'fp-ts/Either';
import { pipe } from 'fp-ts/function';

import { projectScaffoldHandler } from './handler.js';
import type { ProjectScaffoldStorage } from './types.js';

const createTestStorage = (): ProjectScaffoldStorage => {
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

const createFailingStorage = (): ProjectScaffoldStorage => ({
  get: async () => { throw new Error('storage failure'); },
  put: async () => { throw new Error('storage failure'); },
  delete: async () => { throw new Error('storage failure'); },
  find: async () => { throw new Error('storage failure'); },
});

const handler = projectScaffoldHandler;

describe('ProjectScaffold handler', () => {
  describe('scaffold', () => {
    it('should create a new project and return ok with name and path', async () => {
      const storage = createTestStorage();
      const result = await handler.scaffold({ name: 'my-app' }, storage)();
      expect(E.isRight(result)).toBe(true);
      if (E.isRight(result)) {
        expect(result.right.variant).toBe('ok');
        if (result.right.variant === 'ok') {
          expect(result.right.project).toBe('my-app');
          expect(result.right.path).toBe('./my-app/');
        }
      }
    });

    it('should return alreadyExists when project already exists', async () => {
      const storage = createTestStorage();
      // Create the project first
      await handler.scaffold({ name: 'existing' }, storage)();

      // Try to create again
      const result = await handler.scaffold({ name: 'existing' }, storage)();
      expect(E.isRight(result)).toBe(true);
      if (E.isRight(result)) {
        expect(result.right.variant).toBe('alreadyExists');
        if (result.right.variant === 'alreadyExists') {
          expect(result.right.name).toBe('existing');
        }
      }
    });

    it('should persist project record in storage', async () => {
      const storage = createTestStorage();
      await handler.scaffold({ name: 'persisted' }, storage)();

      const stored = await storage.get('projects', 'persisted');
      expect(stored).not.toBeNull();
      if (stored) {
        expect(stored.name).toBe('persisted');
        expect(stored.path).toBe('projects/persisted');
        expect(stored.createdAt).toBeDefined();
      }
    });

    it('should return left on storage failure', async () => {
      const storage = createFailingStorage();
      const result = await handler.scaffold({ name: 'test' }, storage)();
      expect(E.isLeft(result)).toBe(true);
    });
  });
});
