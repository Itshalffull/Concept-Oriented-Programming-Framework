// Branch — handler.test.ts
// Unit tests for branch handler actions.

import { describe, it, expect } from 'vitest';
import * as TE from 'fp-ts/TaskEither';
import * as E from 'fp-ts/Either';
import { pipe } from 'fp-ts/function';

import { branchHandler } from './handler.js';
import type { BranchStorage } from './types.js';

// In-memory test storage
const createTestStorage = (): BranchStorage => {
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

// Failing storage for error propagation tests
const createFailingStorage = (): BranchStorage => ({
  get: async () => { throw new Error('storage failure'); },
  put: async () => { throw new Error('storage failure'); },
  delete: async () => { throw new Error('storage failure'); },
  find: async () => { throw new Error('storage failure'); },
});

/** Seed a DAG node into storage so branch operations can validate node existence. */
const seedDagNode = async (storage: BranchStorage, nodeId: string, parent: string = '') => {
  await storage.put('dag_node', nodeId, { id: nodeId, parent });
};

/** Seed a branch record directly. */
const seedBranch = async (
  storage: BranchStorage,
  name: string,
  head: string,
  opts: { protected?: boolean; upstream?: string | null } = {},
) => {
  await storage.put('branch', name, {
    name,
    head,
    protected: opts.protected ?? false,
    upstream: opts.upstream ?? null,
    archived: false,
    history: JSON.stringify([head]),
  });
};

describe('Branch handler', () => {
  describe('create', () => {
    it('should return ok when creating a new branch from existing node', async () => {
      const storage = createTestStorage();
      await seedDagNode(storage, 'node-1');

      const result = await branchHandler.create(
        { name: 'feature-a', fromNode: 'node-1' },
        storage,
      )();

      expect(E.isRight(result)).toBe(true);
      if (E.isRight(result)) {
        expect(result.right.variant).toBe('ok');
        if (result.right.variant === 'ok') {
          expect(result.right.branch).toBe('feature-a');
        }
      }
    });

    it('should return exists when branch name already taken', async () => {
      const storage = createTestStorage();
      await seedDagNode(storage, 'node-1');
      await seedBranch(storage, 'feature-a', 'node-1');

      const result = await branchHandler.create(
        { name: 'feature-a', fromNode: 'node-1' },
        storage,
      )();

      expect(E.isRight(result)).toBe(true);
      if (E.isRight(result)) {
        expect(result.right.variant).toBe('exists');
      }
    });

    it('should return unknownNode when fromNode does not exist', async () => {
      const storage = createTestStorage();

      const result = await branchHandler.create(
        { name: 'feature-a', fromNode: 'nonexistent-node' },
        storage,
      )();

      expect(E.isRight(result)).toBe(true);
      if (E.isRight(result)) {
        expect(result.right.variant).toBe('unknownNode');
      }
    });

    it('should return Left on storage failure', async () => {
      const storage = createFailingStorage();

      const result = await branchHandler.create(
        { name: 'feature-a', fromNode: 'node-1' },
        storage,
      )();

      expect(E.isLeft(result)).toBe(true);
    });
  });

  describe('advance', () => {
    it('should return ok when advancing a non-protected branch', async () => {
      const storage = createTestStorage();
      await seedDagNode(storage, 'node-1');
      await seedDagNode(storage, 'node-2', 'node-1');
      await seedBranch(storage, 'feature-a', 'node-1');

      const result = await branchHandler.advance(
        { branch: 'feature-a', newNode: 'node-2' },
        storage,
      )();

      expect(E.isRight(result)).toBe(true);
      if (E.isRight(result)) {
        expect(result.right.variant).toBe('ok');
      }
    });

    it('should return notFound when branch does not exist', async () => {
      const storage = createTestStorage();

      const result = await branchHandler.advance(
        { branch: 'nonexistent', newNode: 'node-2' },
        storage,
      )();

      expect(E.isRight(result)).toBe(true);
      if (E.isRight(result)) {
        expect(result.right.variant).toBe('notFound');
      }
    });

    it('should return protected when branch is protected', async () => {
      const storage = createTestStorage();
      await seedDagNode(storage, 'node-1');
      await seedBranch(storage, 'main', 'node-1', { protected: true });

      const result = await branchHandler.advance(
        { branch: 'main', newNode: 'node-2' },
        storage,
      )();

      expect(E.isRight(result)).toBe(true);
      if (E.isRight(result)) {
        expect(result.right.variant).toBe('protected');
      }
    });

    it('should return unknownNode when newNode does not exist', async () => {
      const storage = createTestStorage();
      await seedDagNode(storage, 'node-1');
      await seedBranch(storage, 'feature-a', 'node-1');

      const result = await branchHandler.advance(
        { branch: 'feature-a', newNode: 'nonexistent-node' },
        storage,
      )();

      expect(E.isRight(result)).toBe(true);
      if (E.isRight(result)) {
        expect(result.right.variant).toBe('unknownNode');
      }
    });

    it('should return Left on storage failure', async () => {
      const storage = createFailingStorage();

      const result = await branchHandler.advance(
        { branch: 'feature-a', newNode: 'node-2' },
        storage,
      )();

      expect(E.isLeft(result)).toBe(true);
    });
  });

  describe('delete', () => {
    it('should return ok when deleting a non-protected branch', async () => {
      const storage = createTestStorage();
      await seedBranch(storage, 'feature-a', 'node-1');

      const result = await branchHandler.delete(
        { branch: 'feature-a' },
        storage,
      )();

      expect(E.isRight(result)).toBe(true);
      if (E.isRight(result)) {
        expect(result.right.variant).toBe('ok');
      }
    });

    it('should return notFound when branch does not exist', async () => {
      const storage = createTestStorage();

      const result = await branchHandler.delete(
        { branch: 'nonexistent' },
        storage,
      )();

      expect(E.isRight(result)).toBe(true);
      if (E.isRight(result)) {
        expect(result.right.variant).toBe('notFound');
      }
    });

    it('should return protected when branch is protected', async () => {
      const storage = createTestStorage();
      await seedBranch(storage, 'main', 'node-1', { protected: true });

      const result = await branchHandler.delete(
        { branch: 'main' },
        storage,
      )();

      expect(E.isRight(result)).toBe(true);
      if (E.isRight(result)) {
        expect(result.right.variant).toBe('protected');
      }
    });

    it('should return Left on storage failure', async () => {
      const storage = createFailingStorage();

      const result = await branchHandler.delete(
        { branch: 'feature-a' },
        storage,
      )();

      expect(E.isLeft(result)).toBe(true);
    });
  });

  describe('protect', () => {
    it('should return ok when branch exists', async () => {
      const storage = createTestStorage();
      await seedBranch(storage, 'main', 'node-1');

      const result = await branchHandler.protect(
        { branch: 'main' },
        storage,
      )();

      expect(E.isRight(result)).toBe(true);
      if (E.isRight(result)) {
        expect(result.right.variant).toBe('ok');
      }
    });

    it('should return notFound when branch does not exist', async () => {
      const storage = createTestStorage();

      const result = await branchHandler.protect(
        { branch: 'nonexistent' },
        storage,
      )();

      expect(E.isRight(result)).toBe(true);
      if (E.isRight(result)) {
        expect(result.right.variant).toBe('notFound');
      }
    });

    it('should return Left on storage failure', async () => {
      const storage = createFailingStorage();

      const result = await branchHandler.protect(
        { branch: 'main' },
        storage,
      )();

      expect(E.isLeft(result)).toBe(true);
    });
  });

  describe('setUpstream', () => {
    it('should return ok when both branches exist', async () => {
      const storage = createTestStorage();
      await seedBranch(storage, 'feature-a', 'node-1');
      await seedBranch(storage, 'main', 'node-1');

      const result = await branchHandler.setUpstream(
        { branch: 'feature-a', upstream: 'main' },
        storage,
      )();

      expect(E.isRight(result)).toBe(true);
      if (E.isRight(result)) {
        expect(result.right.variant).toBe('ok');
      }
    });

    it('should return notFound when branch does not exist', async () => {
      const storage = createTestStorage();
      await seedBranch(storage, 'main', 'node-1');

      const result = await branchHandler.setUpstream(
        { branch: 'nonexistent', upstream: 'main' },
        storage,
      )();

      expect(E.isRight(result)).toBe(true);
      if (E.isRight(result)) {
        expect(result.right.variant).toBe('notFound');
      }
    });

    it('should return notFound when upstream does not exist', async () => {
      const storage = createTestStorage();
      await seedBranch(storage, 'feature-a', 'node-1');

      const result = await branchHandler.setUpstream(
        { branch: 'feature-a', upstream: 'nonexistent' },
        storage,
      )();

      expect(E.isRight(result)).toBe(true);
      if (E.isRight(result)) {
        expect(result.right.variant).toBe('notFound');
      }
    });

    it('should return Left on storage failure', async () => {
      const storage = createFailingStorage();

      const result = await branchHandler.setUpstream(
        { branch: 'feature-a', upstream: 'main' },
        storage,
      )();

      expect(E.isLeft(result)).toBe(true);
    });
  });

  describe('divergencePoint', () => {
    it('should return noDivergence when branches point to same node', async () => {
      const storage = createTestStorage();
      await seedDagNode(storage, 'node-1');
      await seedBranch(storage, 'branch-a', 'node-1');
      await seedBranch(storage, 'branch-b', 'node-1');

      const result = await branchHandler.divergencePoint(
        { b1: 'branch-a', b2: 'branch-b' },
        storage,
      )();

      expect(E.isRight(result)).toBe(true);
      if (E.isRight(result)) {
        expect(result.right.variant).toBe('noDivergence');
      }
    });

    it('should return notFound when a branch does not exist', async () => {
      const storage = createTestStorage();
      await seedBranch(storage, 'branch-a', 'node-1');

      const result = await branchHandler.divergencePoint(
        { b1: 'branch-a', b2: 'nonexistent' },
        storage,
      )();

      expect(E.isRight(result)).toBe(true);
      if (E.isRight(result)) {
        expect(result.right.variant).toBe('notFound');
      }
    });

    it('should return Left on storage failure', async () => {
      const storage = createFailingStorage();

      const result = await branchHandler.divergencePoint(
        { b1: 'branch-a', b2: 'branch-b' },
        storage,
      )();

      expect(E.isLeft(result)).toBe(true);
    });
  });

  describe('archive', () => {
    it('should return ok when branch exists', async () => {
      const storage = createTestStorage();
      await seedBranch(storage, 'feature-a', 'node-1');

      const result = await branchHandler.archive(
        { branch: 'feature-a' },
        storage,
      )();

      expect(E.isRight(result)).toBe(true);
      if (E.isRight(result)) {
        expect(result.right.variant).toBe('ok');
      }
    });

    it('should return notFound when branch does not exist', async () => {
      const storage = createTestStorage();

      const result = await branchHandler.archive(
        { branch: 'nonexistent' },
        storage,
      )();

      expect(E.isRight(result)).toBe(true);
      if (E.isRight(result)) {
        expect(result.right.variant).toBe('notFound');
      }
    });

    it('should return Left on storage failure', async () => {
      const storage = createFailingStorage();

      const result = await branchHandler.archive(
        { branch: 'feature-a' },
        storage,
      )();

      expect(E.isLeft(result)).toBe(true);
    });
  });
});
