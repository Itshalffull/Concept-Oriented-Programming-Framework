// Migration — handler.test.ts
import { describe, it, expect } from 'vitest';
import * as TE from 'fp-ts/TaskEither';
import * as E from 'fp-ts/Either';
import { pipe } from 'fp-ts/function';

import { migrationHandler } from './handler.js';
import type { MigrationStorage } from './types.js';

const createTestStorage = (): MigrationStorage => {
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

const createFailingStorage = (): MigrationStorage => ({
  get: async () => { throw new Error('storage failure'); },
  put: async () => { throw new Error('storage failure'); },
  delete: async () => { throw new Error('storage failure'); },
  find: async () => { throw new Error('storage failure'); },
});

const handler = migrationHandler;

describe('Migration handler', () => {
  describe('plan', () => {
    it('should create a migration plan for version upgrade', async () => {
      const storage = createTestStorage();
      const result = await handler.plan(
        { concept: 'User', fromVersion: 1, toVersion: 3 },
        storage,
      )();
      expect(E.isRight(result)).toBe(true);
      if (E.isRight(result)) {
        expect(result.right.variant).toBe('ok');
        if (result.right.variant === 'ok') {
          expect(result.right.steps).toHaveLength(2);
          expect(result.right.steps[0]).toBe('upgrade_v1_to_v2');
          expect(result.right.steps[1]).toBe('upgrade_v2_to_v3');
          expect(result.right.estimatedRecords).toBeGreaterThan(0);
        }
      }
    });

    it('should create a migration plan for version downgrade', async () => {
      const storage = createTestStorage();
      const result = await handler.plan(
        { concept: 'User', fromVersion: 3, toVersion: 1 },
        storage,
      )();
      expect(E.isRight(result)).toBe(true);
      if (E.isRight(result)) {
        expect(result.right.variant).toBe('ok');
        if (result.right.variant === 'ok') {
          expect(result.right.steps[0]).toBe('downgrade_v3_to_v2');
        }
      }
    });

    it('should return noMigrationNeeded when versions are same', async () => {
      const storage = createTestStorage();
      const result = await handler.plan(
        { concept: 'User', fromVersion: 5, toVersion: 5 },
        storage,
      )();
      expect(E.isRight(result)).toBe(true);
      if (E.isRight(result)) {
        expect(result.right.variant).toBe('noMigrationNeeded');
      }
    });

    it('should return incompatible for version jump exceeding max', async () => {
      const storage = createTestStorage();
      const result = await handler.plan(
        { concept: 'User', fromVersion: 1, toVersion: 20 },
        storage,
      )();
      expect(E.isRight(result)).toBe(true);
      if (E.isRight(result)) {
        expect(result.right.variant).toBe('incompatible');
      }
    });

    it('should return incompatible for negative versions', async () => {
      const storage = createTestStorage();
      const result = await handler.plan(
        { concept: 'User', fromVersion: -1, toVersion: 2 },
        storage,
      )();
      expect(E.isRight(result)).toBe(true);
      if (E.isRight(result)) {
        expect(result.right.variant).toBe('incompatible');
      }
    });
  });

  describe('expand', () => {
    it('should expand a planned migration', async () => {
      const storage = createTestStorage();
      const planResult = await handler.plan(
        { concept: 'User', fromVersion: 1, toVersion: 2 },
        storage,
      )();
      if (E.isRight(planResult) && planResult.right.variant === 'ok') {
        const result = await handler.expand(
          { migration: planResult.right.migration },
          storage,
        )();
        expect(E.isRight(result)).toBe(true);
        if (E.isRight(result)) {
          expect(result.right.variant).toBe('ok');
        }
      }
    });

    it('should return failed for non-existent migration', async () => {
      const storage = createTestStorage();
      const result = await handler.expand({ migration: 'nonexistent' }, storage)();
      expect(E.isRight(result)).toBe(true);
      if (E.isRight(result)) {
        expect(result.right.variant).toBe('failed');
      }
    });

    it('should return failed when migration is not in planned phase', async () => {
      const storage = createTestStorage();
      const planResult = await handler.plan(
        { concept: 'User', fromVersion: 1, toVersion: 2 },
        storage,
      )();
      if (E.isRight(planResult) && planResult.right.variant === 'ok') {
        const migId = planResult.right.migration;
        await handler.expand({ migration: migId }, storage)();
        // Try to expand again (now in 'expanded' phase)
        const result = await handler.expand({ migration: migId }, storage)();
        expect(E.isRight(result)).toBe(true);
        if (E.isRight(result)) {
          expect(result.right.variant).toBe('failed');
        }
      }
    });
  });

  describe('migrate', () => {
    it('should migrate an expanded migration', async () => {
      const storage = createTestStorage();
      const planResult = await handler.plan(
        { concept: 'User', fromVersion: 1, toVersion: 2 },
        storage,
      )();
      if (E.isRight(planResult) && planResult.right.variant === 'ok') {
        const migId = planResult.right.migration;
        await handler.expand({ migration: migId }, storage)();
        const result = await handler.migrate({ migration: migId }, storage)();
        expect(E.isRight(result)).toBe(true);
        if (E.isRight(result)) {
          expect(result.right.variant).toBe('ok');
          if (result.right.variant === 'ok') {
            expect(result.right.recordsMigrated).toBeGreaterThan(0);
          }
        }
      }
    });

    it('should return left for non-existent migration', async () => {
      const storage = createTestStorage();
      const result = await handler.migrate({ migration: 'missing' }, storage)();
      expect(E.isLeft(result)).toBe(true);
    });

    it('should return left when migration is not in expanded phase', async () => {
      const storage = createTestStorage();
      const planResult = await handler.plan(
        { concept: 'User', fromVersion: 1, toVersion: 2 },
        storage,
      )();
      if (E.isRight(planResult) && planResult.right.variant === 'ok') {
        // Try to migrate without expanding
        const result = await handler.migrate(
          { migration: planResult.right.migration },
          storage,
        )();
        expect(E.isLeft(result)).toBe(true);
      }
    });
  });

  describe('contract', () => {
    it('should contract a completed migration', async () => {
      const storage = createTestStorage();
      const planResult = await handler.plan(
        { concept: 'User', fromVersion: 1, toVersion: 2 },
        storage,
      )();
      if (E.isRight(planResult) && planResult.right.variant === 'ok') {
        const migId = planResult.right.migration;
        await handler.expand({ migration: migId }, storage)();
        await handler.migrate({ migration: migId }, storage)();
        const result = await handler.contract({ migration: migId }, storage)();
        expect(E.isRight(result)).toBe(true);
        if (E.isRight(result)) {
          expect(result.right.variant).toBe('ok');
        }
      }
    });

    it('should rollback when migration is not in migrated phase', async () => {
      const storage = createTestStorage();
      const planResult = await handler.plan(
        { concept: 'User', fromVersion: 1, toVersion: 2 },
        storage,
      )();
      if (E.isRight(planResult) && planResult.right.variant === 'ok') {
        // Contract without migrating
        const result = await handler.contract(
          { migration: planResult.right.migration },
          storage,
        )();
        expect(E.isRight(result)).toBe(true);
        if (E.isRight(result)) {
          expect(result.right.variant).toBe('rollback');
        }
      }
    });
  });

  describe('status', () => {
    it('should return status for an existing migration', async () => {
      const storage = createTestStorage();
      const planResult = await handler.plan(
        { concept: 'User', fromVersion: 1, toVersion: 2 },
        storage,
      )();
      if (E.isRight(planResult) && planResult.right.variant === 'ok') {
        const result = await handler.status(
          { migration: planResult.right.migration },
          storage,
        )();
        expect(E.isRight(result)).toBe(true);
        if (E.isRight(result)) {
          expect(result.right.variant).toBe('ok');
          expect(result.right.phase).toBe('planned');
          expect(result.right.progress).toBe(0);
        }
      }
    });

    it('should return left for non-existent migration', async () => {
      const storage = createTestStorage();
      const result = await handler.status({ migration: 'nope' }, storage)();
      expect(E.isLeft(result)).toBe(true);
    });
  });
});
