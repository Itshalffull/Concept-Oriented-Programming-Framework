// ============================================================
// DeploymentHealth Handler Tests
//
// Tests for health snapshot recording, runtime/transport/storage
// health queries, sync delivery, concept instances, cross-runtime
// latency, hotspots, error correlation, window comparison, and
// SLO status.
// ============================================================

import { describe, it, expect, beforeEach } from 'vitest';
import { createInMemoryStorage } from '../runtime/adapters/storage.js';
import { deploymentHealthHandler } from '../handlers/ts/score/deployment-health.handler.js';

describe('DeploymentHealth Handler', () => {
  let storage: ReturnType<typeof createInMemoryStorage>;

  const sampleSnapshot = JSON.stringify({
    runtimeStatuses: [
      { name: 'api', status: 'healthy', uptime: 86400 },
      { name: 'worker', status: 'degraded', uptime: 3600 },
    ],
    transportStatuses: [
      { name: 'redis', status: 'healthy', pendingMessages: 12 },
    ],
    storageStatuses: [
      { name: 'postgres', status: 'healthy', connectionPool: 18 },
    ],
    syncDeliveryRates: [
      { sync: 'onTodoCreate', delivered: 100, failed: 2, rate: 0.98 },
    ],
    conceptInstanceCounts: [
      { concept: 'Todo', count: 5000 },
      { concept: 'User', count: 200 },
    ],
    crossRuntimeLatency: [
      { from: 'api', to: 'worker', p50: 5, p99: 25 },
    ],
    alerts: [
      { severity: 'warning', message: 'Worker uptime low' },
    ],
  });

  beforeEach(() => {
    storage = createInMemoryStorage();
  });

  describe('record', () => {
    it('records a health snapshot', async () => {
      const result = await deploymentHealthHandler.record(
        { deployment: 'prod', snapshot: sampleSnapshot },
        storage,
      );
      expect(result.variant).toBe('ok');
      expect(result.check).toBeDefined();
    });

    it('records multiple snapshots', async () => {
      await deploymentHealthHandler.record(
        { deployment: 'prod', snapshot: sampleSnapshot },
        storage,
      );
      await deploymentHealthHandler.record(
        { deployment: 'prod', snapshot: sampleSnapshot },
        storage,
      );
      const all = await storage.find('deployment-health');
      expect(all).toHaveLength(2);
    });
  });

  describe('runtimeHealth', () => {
    it('returns runtime statuses from latest snapshot', async () => {
      await deploymentHealthHandler.record(
        { deployment: 'prod', snapshot: sampleSnapshot },
        storage,
      );
      const result = await deploymentHealthHandler.runtimeHealth(
        { deployment: 'prod' },
        storage,
      );
      expect(result.variant).toBe('ok');
      const runtimes = JSON.parse(result.runtimes as string);
      expect(runtimes).toHaveLength(2);
      expect(runtimes[0].name).toBe('api');
    });

    it('returns empty for nonexistent deployment', async () => {
      const result = await deploymentHealthHandler.runtimeHealth(
        { deployment: 'nope' },
        storage,
      );
      expect(result.variant).toBe('ok');
      expect(result.runtimes).toBe('[]');
    });
  });

  describe('transportHealth', () => {
    it('returns transport statuses', async () => {
      await deploymentHealthHandler.record(
        { deployment: 'prod', snapshot: sampleSnapshot },
        storage,
      );
      const result = await deploymentHealthHandler.transportHealth(
        { deployment: 'prod' },
        storage,
      );
      expect(result.variant).toBe('ok');
      const transports = JSON.parse(result.transports as string);
      expect(transports).toHaveLength(1);
    });
  });

  describe('storageHealth', () => {
    it('returns storage adapter statuses', async () => {
      await deploymentHealthHandler.record(
        { deployment: 'prod', snapshot: sampleSnapshot },
        storage,
      );
      const result = await deploymentHealthHandler.storageHealth(
        { deployment: 'prod' },
        storage,
      );
      expect(result.variant).toBe('ok');
      const adapters = JSON.parse(result.adapters as string);
      expect(adapters).toHaveLength(1);
    });
  });

  describe('syncDelivery', () => {
    it('returns sync delivery rates', async () => {
      await deploymentHealthHandler.record(
        { deployment: 'prod', snapshot: sampleSnapshot },
        storage,
      );
      const result = await deploymentHealthHandler.syncDelivery(
        { deployment: 'prod', since: '' },
        storage,
      );
      expect(result.variant).toBe('ok');
      const syncs = JSON.parse(result.syncs as string);
      expect(syncs).toHaveLength(1);
      expect(syncs[0].rate).toBe(0.98);
    });
  });

  describe('conceptInstances', () => {
    it('returns concept instance counts', async () => {
      await deploymentHealthHandler.record(
        { deployment: 'prod', snapshot: sampleSnapshot },
        storage,
      );
      const result = await deploymentHealthHandler.conceptInstances(
        { deployment: 'prod' },
        storage,
      );
      expect(result.variant).toBe('ok');
      const instances = JSON.parse(result.instances as string);
      expect(instances).toHaveLength(2);
      expect(instances[0].concept).toBe('Todo');
    });
  });

  describe('crossRuntimeLatency', () => {
    it('returns latency matrix', async () => {
      await deploymentHealthHandler.record(
        { deployment: 'prod', snapshot: sampleSnapshot },
        storage,
      );
      const result = await deploymentHealthHandler.crossRuntimeLatency(
        { deployment: 'prod' },
        storage,
      );
      expect(result.variant).toBe('ok');
      const matrix = JSON.parse(result.matrix as string);
      expect(matrix).toHaveLength(1);
      expect(matrix[0].p50).toBe(5);
    });
  });

  describe('hotspots', () => {
    it('returns empty hotspots (stub)', async () => {
      await deploymentHealthHandler.record(
        { deployment: 'prod', snapshot: sampleSnapshot },
        storage,
      );
      const result = await deploymentHealthHandler.hotspots(
        { deployment: 'prod', since: '', topN: 5 },
        storage,
      );
      expect(result.variant).toBe('ok');
      expect(result.hotspots).toBe('[]');
    });
  });

  describe('correlateWithErrors', () => {
    it('returns empty correlations (stub)', async () => {
      const result = await deploymentHealthHandler.correlateWithErrors(
        { deployment: 'prod', since: '' },
        storage,
      );
      expect(result.variant).toBe('ok');
      expect(result.correlations).toBe('[]');
    });
  });

  describe('compareWindows', () => {
    it('returns comparison structure (stub)', async () => {
      const result = await deploymentHealthHandler.compareWindows(
        { deployment: 'prod', windowA: '2024-01-01/2024-01-02', windowB: '2024-01-02/2024-01-03' },
        storage,
      );
      expect(result.variant).toBe('ok');
      const comparison = JSON.parse(result.comparison as string);
      expect(comparison.runtimeChanges).toEqual([]);
    });
  });

  describe('sloStatus', () => {
    it('returns empty SLOs (stub)', async () => {
      const result = await deploymentHealthHandler.sloStatus(
        { deployment: 'prod' },
        storage,
      );
      expect(result.variant).toBe('ok');
      expect(result.slos).toBe('[]');
    });
  });
});
