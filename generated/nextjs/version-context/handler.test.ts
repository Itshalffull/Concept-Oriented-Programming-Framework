// VersionContext — handler.test.ts
// fp-ts handler tests for per-user version space stack tracking.

import { describe, it, expect } from 'vitest';
import * as TE from 'fp-ts/TaskEither';
import * as E from 'fp-ts/Either';
import { pipe } from 'fp-ts/function';

import { versionContextHandler } from './handler.js';
import type { VersionContextStorage } from './types.js';

const createTestStorage = (): VersionContextStorage => {
  const store = new Map<string, Map<string, Record<string, unknown>>>();
  return {
    get: async (relation, key) => store.get(relation)?.get(key) ?? null,
    put: async (relation, key, value) => {
      if (!store.has(relation)) store.set(relation, new Map());
      store.get(relation)!.set(key, value);
    },
    delete: async (relation, key) => store.get(relation)?.delete(key) ?? false,
    find: async (relation, filter?) => {
      const all = [...(store.get(relation)?.values() ?? [])];
      if (!filter) return all;
      return all.filter((record) =>
        Object.entries(filter).every(([k, v]) => record[k] === v),
      );
    },
  };
};

const createFailingStorage = (): VersionContextStorage => ({
  get: async () => { throw new Error('storage failure'); },
  put: async () => { throw new Error('storage failure'); },
  delete: async () => { throw new Error('storage failure'); },
  find: async () => { throw new Error('storage failure'); },
});

describe('VersionContext handler (fp-ts)', () => {
  describe('push', () => {
    it('creates a new context and pushes first space', async () => {
      const storage = createTestStorage();
      const result = await versionContextHandler.push(
        { user: 'alice', space_id: 'space-1' },
        storage,
      )();
      expect(E.isRight(result)).toBe(true);
      if (E.isRight(result)) {
        expect(result.right.variant).toBe('ok');
      }
    });

    it('appends to existing context stack', async () => {
      const storage = createTestStorage();
      await versionContextHandler.push(
        { user: 'alice', space_id: 'space-1' },
        storage,
      )();
      const result = await versionContextHandler.push(
        { user: 'alice', space_id: 'space-2' },
        storage,
      )();
      expect(E.isRight(result)).toBe(true);
      if (E.isRight(result)) {
        expect(result.right.variant).toBe('ok');
      }

      // Verify stack has both spaces
      const getResult = await versionContextHandler.get(
        { user: 'alice' },
        storage,
      )();
      expect(E.isRight(getResult)).toBe(true);
      if (E.isRight(getResult)) {
        expect((getResult.right as any).stack).toEqual(['space-1', 'space-2']);
      }
    });

    it('keeps separate stacks for different users', async () => {
      const storage = createTestStorage();
      await versionContextHandler.push(
        { user: 'alice', space_id: 'space-a' },
        storage,
      )();
      await versionContextHandler.push(
        { user: 'bob', space_id: 'space-b' },
        storage,
      )();

      const aliceResult = await versionContextHandler.get(
        { user: 'alice' },
        storage,
      )();
      expect(E.isRight(aliceResult)).toBe(true);
      if (E.isRight(aliceResult)) {
        expect((aliceResult.right as any).stack).toEqual(['space-a']);
      }
    });

    it('propagates storage errors', async () => {
      const storage = createFailingStorage();
      const result = await versionContextHandler.push(
        { user: 'alice', space_id: 'space-1' },
        storage,
      )();
      expect(E.isLeft(result)).toBe(true);
    });
  });

  describe('pop', () => {
    it('removes space from stack', async () => {
      const storage = createTestStorage();
      await versionContextHandler.push(
        { user: 'alice', space_id: 'space-1' },
        storage,
      )();
      await versionContextHandler.push(
        { user: 'alice', space_id: 'space-2' },
        storage,
      )();

      const result = await versionContextHandler.pop(
        { user: 'alice', space_id: 'space-2' },
        storage,
      )();
      expect(E.isRight(result)).toBe(true);
      if (E.isRight(result)) {
        expect(result.right.variant).toBe('ok');
      }

      // Verify stack only has space-1
      const getResult = await versionContextHandler.get(
        { user: 'alice' },
        storage,
      )();
      if (E.isRight(getResult)) {
        expect((getResult.right as any).stack).toEqual(['space-1']);
      }
    });

    it('returns ok even when user has no context', async () => {
      const storage = createTestStorage();
      const result = await versionContextHandler.pop(
        { user: 'nobody', space_id: 'space-1' },
        storage,
      )();
      expect(E.isRight(result)).toBe(true);
      if (E.isRight(result)) {
        expect(result.right.variant).toBe('ok');
      }
    });

    it('deletes context when stack becomes empty', async () => {
      const storage = createTestStorage();
      await versionContextHandler.push(
        { user: 'alice', space_id: 'space-1' },
        storage,
      )();

      await versionContextHandler.pop(
        { user: 'alice', space_id: 'space-1' },
        storage,
      )();

      const getResult = await versionContextHandler.get(
        { user: 'alice' },
        storage,
      )();
      expect(E.isRight(getResult)).toBe(true);
      if (E.isRight(getResult)) {
        expect(getResult.right.variant).toBe('no_context');
      }
    });
  });

  describe('get', () => {
    it('returns ok with stack for existing context', async () => {
      const storage = createTestStorage();
      await versionContextHandler.push(
        { user: 'alice', space_id: 'space-1' },
        storage,
      )();

      const result = await versionContextHandler.get(
        { user: 'alice' },
        storage,
      )();
      expect(E.isRight(result)).toBe(true);
      if (E.isRight(result)) {
        expect(result.right.variant).toBe('ok');
        expect((result.right as any).stack).toEqual(['space-1']);
      }
    });

    it('returns no_context for user without context', async () => {
      const storage = createTestStorage();
      const result = await versionContextHandler.get(
        { user: 'nobody' },
        storage,
      )();
      expect(E.isRight(result)).toBe(true);
      if (E.isRight(result)) {
        expect(result.right.variant).toBe('no_context');
      }
    });

    it('propagates storage errors', async () => {
      const storage = createFailingStorage();
      const result = await versionContextHandler.get(
        { user: 'alice' },
        storage,
      )();
      expect(E.isLeft(result)).toBe(true);
    });
  });

  describe('resolveFor', () => {
    it('resolves to innermost space in stack', async () => {
      const storage = createTestStorage();
      await versionContextHandler.push(
        { user: 'alice', space_id: 'space-1' },
        storage,
      )();
      await versionContextHandler.push(
        { user: 'alice', space_id: 'space-2' },
        storage,
      )();

      const result = await versionContextHandler.resolveFor(
        { user: 'alice', entity_id: 'e1' },
        storage,
      )();
      expect(E.isRight(result)).toBe(true);
      if (E.isRight(result)) {
        expect(result.right.variant).toBe('ok');
        expect((result.right as any).source).toBe('space-2');
      }
    });

    it('resolves to base when no context exists', async () => {
      const storage = createTestStorage();
      const result = await versionContextHandler.resolveFor(
        { user: 'nobody', entity_id: 'e1' },
        storage,
      )();
      expect(E.isRight(result)).toBe(true);
      if (E.isRight(result)) {
        expect(result.right.variant).toBe('ok');
        expect((result.right as any).source).toBe('base');
      }
    });

    it('propagates storage errors', async () => {
      const storage = createFailingStorage();
      const result = await versionContextHandler.resolveFor(
        { user: 'alice', entity_id: 'e1' },
        storage,
      )();
      expect(E.isLeft(result)).toBe(true);
    });
  });

  describe('multi-step sequence: push -> get -> pop -> get', () => {
    it('tracks full push/pop lifecycle', async () => {
      const storage = createTestStorage();

      // Push two spaces
      await versionContextHandler.push({ user: 'alice', space_id: 's1' }, storage)();
      await versionContextHandler.push({ user: 'alice', space_id: 's2' }, storage)();

      // Get should show both
      const get1 = await versionContextHandler.get({ user: 'alice' }, storage)();
      expect(E.isRight(get1)).toBe(true);
      if (E.isRight(get1)) {
        expect((get1.right as any).stack).toEqual(['s1', 's2']);
      }

      // Pop s2
      await versionContextHandler.pop({ user: 'alice', space_id: 's2' }, storage)();

      // Get should show only s1
      const get2 = await versionContextHandler.get({ user: 'alice' }, storage)();
      expect(E.isRight(get2)).toBe(true);
      if (E.isRight(get2)) {
        expect((get2.right as any).stack).toEqual(['s1']);
      }
    });
  });
});
