// Branch concept handler tests -- lifecycle, protection, upstream tracking, and divergence detection.

import { describe, it, expect, beforeEach } from 'vitest';
import { createInMemoryStorage } from '../kernel/src/storage.js';
import { branchHandler, resetBranchCounter } from '../handlers/ts/branch.handler.js';

describe('Branch', () => {
  let storage: ReturnType<typeof createInMemoryStorage>;

  beforeEach(() => {
    storage = createInMemoryStorage();
    resetBranchCounter();
  });

  describe('create', () => {
    it('creates a branch from a given node', async () => {
      const result = await branchHandler.create({ name: 'main', fromNode: 'node-1' }, storage);
      expect(result.variant).toBe('ok');
      expect(result.branch).toBe('branch-1');
    });

    it('rejects duplicate branch names', async () => {
      await branchHandler.create({ name: 'main', fromNode: 'node-1' }, storage);
      const result = await branchHandler.create({ name: 'main', fromNode: 'node-2' }, storage);
      expect(result.variant).toBe('exists');
    });

    it('allows multiple branches with different names', async () => {
      const r1 = await branchHandler.create({ name: 'main', fromNode: 'node-1' }, storage);
      const r2 = await branchHandler.create({ name: 'feature', fromNode: 'node-1' }, storage);
      expect(r1.variant).toBe('ok');
      expect(r2.variant).toBe('ok');
      expect(r1.branch).not.toBe(r2.branch);
    });
  });

  describe('advance', () => {
    it('advances branch head to a new node', async () => {
      const created = await branchHandler.create({ name: 'main', fromNode: 'node-1' }, storage);
      const branchId = created.branch as string;

      const result = await branchHandler.advance({ branch: branchId, newNode: 'node-2' }, storage);
      expect(result.variant).toBe('ok');

      // Verify head was updated
      const record = await storage.get('branch', branchId);
      expect(record!.head).toBe('node-2');
    });

    it('returns notFound for non-existent branch', async () => {
      const result = await branchHandler.advance({ branch: 'nonexistent', newNode: 'node-2' }, storage);
      expect(result.variant).toBe('notFound');
    });

    it('rejects advance on protected branch', async () => {
      const created = await branchHandler.create({ name: 'main', fromNode: 'node-1' }, storage);
      const branchId = created.branch as string;

      await branchHandler.protect({ branch: branchId }, storage);
      const result = await branchHandler.advance({ branch: branchId, newNode: 'node-2' }, storage);
      expect(result.variant).toBe('protected');
    });
  });

  describe('delete', () => {
    it('deletes an unprotected branch', async () => {
      const created = await branchHandler.create({ name: 'feature', fromNode: 'node-1' }, storage);
      const branchId = created.branch as string;

      const result = await branchHandler.delete({ branch: branchId }, storage);
      expect(result.variant).toBe('ok');

      // Verify branch is gone
      const record = await storage.get('branch', branchId);
      expect(record).toBeNull();
    });

    it('rejects deletion of protected branch', async () => {
      const created = await branchHandler.create({ name: 'main', fromNode: 'node-1' }, storage);
      const branchId = created.branch as string;

      await branchHandler.protect({ branch: branchId }, storage);
      const result = await branchHandler.delete({ branch: branchId }, storage);
      expect(result.variant).toBe('protected');
    });

    it('returns notFound for non-existent branch', async () => {
      const result = await branchHandler.delete({ branch: 'nonexistent' }, storage);
      expect(result.variant).toBe('notFound');
    });
  });

  describe('protect', () => {
    it('marks a branch as protected', async () => {
      const created = await branchHandler.create({ name: 'main', fromNode: 'node-1' }, storage);
      const branchId = created.branch as string;

      const result = await branchHandler.protect({ branch: branchId }, storage);
      expect(result.variant).toBe('ok');

      const record = await storage.get('branch', branchId);
      expect(record!.protected).toBe(true);
    });

    it('returns notFound for non-existent branch', async () => {
      const result = await branchHandler.protect({ branch: 'nonexistent' }, storage);
      expect(result.variant).toBe('notFound');
    });
  });

  describe('setUpstream', () => {
    it('sets upstream relationship between branches', async () => {
      const main = await branchHandler.create({ name: 'main', fromNode: 'node-1' }, storage);
      const feature = await branchHandler.create({ name: 'feature', fromNode: 'node-1' }, storage);
      const mainId = main.branch as string;
      const featureId = feature.branch as string;

      const result = await branchHandler.setUpstream({ branch: featureId, upstream: mainId }, storage);
      expect(result.variant).toBe('ok');

      const record = await storage.get('branch', featureId);
      expect(record!.upstream).toBe(mainId);
    });

    it('returns notFound if branch does not exist', async () => {
      const main = await branchHandler.create({ name: 'main', fromNode: 'node-1' }, storage);
      const result = await branchHandler.setUpstream({ branch: 'nonexistent', upstream: main.branch as string }, storage);
      expect(result.variant).toBe('notFound');
    });

    it('returns notFound if upstream does not exist', async () => {
      const feature = await branchHandler.create({ name: 'feature', fromNode: 'node-1' }, storage);
      const result = await branchHandler.setUpstream({ branch: feature.branch as string, upstream: 'nonexistent' }, storage);
      expect(result.variant).toBe('notFound');
    });
  });

  describe('divergencePoint', () => {
    it('reports noDivergence when both branches point to the same node', async () => {
      await branchHandler.create({ name: 'main', fromNode: 'node-1' }, storage);
      await branchHandler.create({ name: 'feature', fromNode: 'node-1' }, storage);

      const result = await branchHandler.divergencePoint({ b1: 'branch-1', b2: 'branch-2' }, storage);
      expect(result.variant).toBe('noDivergence');
    });

    it('finds divergence point using DAG traversal', async () => {
      // Build a DAG: root -> A -> B (main), root -> A -> C (feature)
      await storage.put('dag-history', 'root', { id: 'root', parents: [], children: ['A'] });
      await storage.put('dag-history', 'A', { id: 'A', parents: ['root'], children: ['B', 'C'] });
      await storage.put('dag-history', 'B', { id: 'B', parents: ['A'], children: [] });
      await storage.put('dag-history', 'C', { id: 'C', parents: ['A'], children: [] });

      await branchHandler.create({ name: 'main', fromNode: 'B' }, storage);
      await branchHandler.create({ name: 'feature', fromNode: 'C' }, storage);

      const result = await branchHandler.divergencePoint({ b1: 'branch-1', b2: 'branch-2' }, storage);
      expect(result.variant).toBe('ok');
      expect(result.nodeId).toBe('A');
    });

    it('returns notFound for non-existent branch', async () => {
      await branchHandler.create({ name: 'main', fromNode: 'node-1' }, storage);
      const result = await branchHandler.divergencePoint({ b1: 'branch-1', b2: 'nonexistent' }, storage);
      expect(result.variant).toBe('notFound');
    });
  });

  describe('archive', () => {
    it('archives a branch', async () => {
      const created = await branchHandler.create({ name: 'old-feature', fromNode: 'node-1' }, storage);
      const branchId = created.branch as string;

      const result = await branchHandler.archive({ branch: branchId }, storage);
      expect(result.variant).toBe('ok');

      const record = await storage.get('branch', branchId);
      expect(record!.archived).toBe(true);
    });

    it('returns notFound for non-existent branch', async () => {
      const result = await branchHandler.archive({ branch: 'nonexistent' }, storage);
      expect(result.variant).toBe('notFound');
    });
  });

  describe('multi-step sequences', () => {
    it('create -> advance -> protect -> reject advance', async () => {
      const created = await branchHandler.create({ name: 'main', fromNode: 'node-1' }, storage);
      const branchId = created.branch as string;

      await branchHandler.advance({ branch: branchId, newNode: 'node-2' }, storage);
      await branchHandler.protect({ branch: branchId }, storage);

      const result = await branchHandler.advance({ branch: branchId, newNode: 'node-3' }, storage);
      expect(result.variant).toBe('protected');

      // Head should remain at node-2
      const record = await storage.get('branch', branchId);
      expect(record!.head).toBe('node-2');
    });
  });
});
