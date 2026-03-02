// SyncEntity — handler.test.ts
import { describe, it, expect } from 'vitest';
import * as TE from 'fp-ts/TaskEither';
import * as E from 'fp-ts/Either';
import { pipe } from 'fp-ts/function';

import { syncEntityHandler } from './handler.js';
import type { SyncEntityStorage } from './types.js';

const createTestStorage = (): SyncEntityStorage => {
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

const createFailingStorage = (): SyncEntityStorage => ({
  get: async () => { throw new Error('storage failure'); },
  put: async () => { throw new Error('storage failure'); },
  delete: async () => { throw new Error('storage failure'); },
  find: async () => { throw new Error('storage failure'); },
});

const handler = syncEntityHandler;

const compiledSpec = JSON.stringify({
  when: [{ action: 'create', variant: 'ok' }],
  then: [{ action: 'notify', variant: 'sent' }],
  annotations: { priority: 'high' },
  tier: 'core',
});

describe('SyncEntity handler', () => {
  describe('register', () => {
    it('should register a new sync entity', async () => {
      const storage = createTestStorage();
      const result = await handler.register(
        { name: 'user-created-sync', source: 'user.sync', compiled: compiledSpec },
        storage,
      )();
      expect(E.isRight(result)).toBe(true);
      if (E.isRight(result)) {
        expect(result.right.variant).toBe('ok');
        if (result.right.variant === 'ok') {
          expect(result.right.sync).toBe('user-created-sync');
        }
      }
    });

    it('should return alreadyRegistered for duplicate', async () => {
      const storage = createTestStorage();
      await handler.register(
        { name: 'user-sync', source: 'user.sync', compiled: compiledSpec },
        storage,
      )();
      const result = await handler.register(
        { name: 'user-sync', source: 'user.sync', compiled: compiledSpec },
        storage,
      )();
      expect(E.isRight(result)).toBe(true);
      if (E.isRight(result)) {
        expect(result.right.variant).toBe('alreadyRegistered');
      }
    });

    it('should parse when/then counts from compiled spec', async () => {
      const storage = createTestStorage();
      await handler.register(
        { name: 'my-sync', source: 'a.sync', compiled: compiledSpec },
        storage,
      )();
      const stored = await storage.get('sync_entity', 'my-sync');
      expect(stored?.whenPatternCount).toBe(1);
      expect(stored?.thenActionCount).toBe(1);
      expect(stored?.tier).toBe('core');
    });

    it('should handle invalid compiled JSON gracefully', async () => {
      const storage = createTestStorage();
      const result = await handler.register(
        { name: 'bad-sync', source: 'a.sync', compiled: 'not json' },
        storage,
      )();
      expect(E.isRight(result)).toBe(true);
      if (E.isRight(result)) {
        expect(result.right.variant).toBe('ok');
      }
    });

    it('should return Left on storage failure', async () => {
      const storage = createFailingStorage();
      const result = await handler.register(
        { name: 'test', source: 'a.sync', compiled: compiledSpec },
        storage,
      )();
      expect(E.isLeft(result)).toBe(true);
    });
  });

  describe('findByConcept', () => {
    it('should find syncs referencing a concept', async () => {
      const storage = createTestStorage();
      const spec = JSON.stringify({
        when: [{ action: 'User.create', variant: 'ok' }],
        then: [{ action: 'notify', variant: 'ok' }],
      });
      await handler.register(
        { name: 'user-notify', source: 'a.sync', compiled: spec },
        storage,
      )();
      const result = await handler.findByConcept(
        { concept: 'User' },
        storage,
      )();
      expect(E.isRight(result)).toBe(true);
      if (E.isRight(result)) {
        const syncs = JSON.parse(result.right.syncs);
        expect(syncs.length).toBeGreaterThanOrEqual(1);
      }
    });
  });

  describe('findTriggerableBy', () => {
    it('should find syncs triggerable by a given action/variant', async () => {
      const storage = createTestStorage();
      await handler.register(
        { name: 'my-sync', source: 'a.sync', compiled: compiledSpec },
        storage,
      )();
      const result = await handler.findTriggerableBy(
        { action: 'create', variant: 'ok' },
        storage,
      )();
      expect(E.isRight(result)).toBe(true);
      if (E.isRight(result)) {
        const syncs = JSON.parse(result.right.syncs);
        expect(syncs).toContain('my-sync');
      }
    });

    it('should return empty for non-matching action', async () => {
      const storage = createTestStorage();
      await handler.register(
        { name: 'my-sync', source: 'a.sync', compiled: compiledSpec },
        storage,
      )();
      const result = await handler.findTriggerableBy(
        { action: 'delete', variant: 'ok' },
        storage,
      )();
      expect(E.isRight(result)).toBe(true);
      if (E.isRight(result)) {
        const syncs = JSON.parse(result.right.syncs);
        expect(syncs.length).toBe(0);
      }
    });
  });

  describe('chainFrom', () => {
    it('should follow sync chains', async () => {
      const storage = createTestStorage();
      const spec1 = JSON.stringify({
        when: [{ action: 'create', variant: 'ok' }],
        then: [{ action: 'notify', variant: 'sent' }],
      });
      const spec2 = JSON.stringify({
        when: [{ action: 'notify', variant: 'sent' }],
        then: [{ action: 'log', variant: 'ok' }],
      });
      await handler.register({ name: 'sync-a', source: 'a.sync', compiled: spec1 }, storage)();
      await handler.register({ name: 'sync-b', source: 'b.sync', compiled: spec2 }, storage)();
      const result = await handler.chainFrom(
        { action: 'create', variant: 'ok', depth: 5 },
        storage,
      )();
      expect(E.isRight(result)).toBe(true);
      if (E.isRight(result)) {
        expect(result.right.variant).toBe('ok');
        if (result.right.variant === 'ok') {
          const chain = JSON.parse(result.right.chain);
          expect(chain).toContain('sync-a');
          expect(chain).toContain('sync-b');
        }
      }
    });

    it('should return noChain when no matching trigger', async () => {
      const storage = createTestStorage();
      const result = await handler.chainFrom(
        { action: 'nonexistent', variant: 'ok', depth: 5 },
        storage,
      )();
      expect(E.isRight(result)).toBe(true);
      if (E.isRight(result)) {
        expect(result.right.variant).toBe('noChain');
      }
    });
  });

  describe('findDeadEnds', () => {
    it('should find syncs with no then-clause actions', async () => {
      const storage = createTestStorage();
      const deadSpec = JSON.stringify({
        when: [{ action: 'create', variant: 'ok' }],
        then: [],
      });
      await handler.register({ name: 'dead-sync', source: 'a.sync', compiled: deadSpec }, storage)();
      const result = await handler.findDeadEnds({}, storage)();
      expect(E.isRight(result)).toBe(true);
      if (E.isRight(result)) {
        const deadEnds = JSON.parse(result.right.deadEnds);
        expect(deadEnds).toContain('dead-sync');
      }
    });
  });

  describe('findOrphanVariants', () => {
    it('should find variants declared in then but never in when', async () => {
      const storage = createTestStorage();
      await handler.register(
        { name: 'my-sync', source: 'a.sync', compiled: compiledSpec },
        storage,
      )();
      const result = await handler.findOrphanVariants({}, storage)();
      expect(E.isRight(result)).toBe(true);
      if (E.isRight(result)) {
        const orphans = JSON.parse(result.right.orphans);
        expect(orphans).toContain('sent');
      }
    });
  });

  describe('get', () => {
    it('should get a registered sync entity', async () => {
      const storage = createTestStorage();
      await handler.register(
        { name: 'my-sync', source: 'a.sync', compiled: compiledSpec },
        storage,
      )();
      const result = await handler.get({ sync: 'my-sync' }, storage)();
      expect(E.isRight(result)).toBe(true);
      if (E.isRight(result)) {
        expect(result.right.variant).toBe('ok');
        if (result.right.variant === 'ok') {
          expect(result.right.name).toBe('my-sync');
          expect(result.right.tier).toBe('core');
          expect(result.right.whenPatternCount).toBe(1);
          expect(result.right.thenActionCount).toBe(1);
        }
      }
    });

    it('should return notfound for unknown sync', async () => {
      const storage = createTestStorage();
      const result = await handler.get({ sync: 'nonexistent' }, storage)();
      expect(E.isRight(result)).toBe(true);
      if (E.isRight(result)) {
        expect(result.right.variant).toBe('notfound');
      }
    });
  });
});
