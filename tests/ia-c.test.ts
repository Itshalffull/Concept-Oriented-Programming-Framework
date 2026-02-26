// ============================================================
// IaC Handler Tests
//
// Coordinate infrastructure-as-code generation and application
// across IaC providers with resource inventory and drift detection.
// ============================================================

import { describe, it, expect, beforeEach } from 'vitest';
import { createInMemoryStorage } from '../runtime/adapters/storage.js';
import {
  iaCHandler,
  resetIaCCounter,
} from '../handlers/ts/ia-c.handler.js';

describe('IaC', () => {
  let storage: ReturnType<typeof createInMemoryStorage>;

  beforeEach(() => {
    storage = createInMemoryStorage();
    resetIaCCounter();
  });

  describe('emit', () => {
    it('emits terraform IaC output', async () => {
      const result = await iaCHandler.emit!(
        { plan: 'myapp', provider: 'terraform' },
        storage,
      );
      expect(result.variant).toBe('ok');
      expect(result.output).toBe('terraform/myapp');
      expect(result.fileCount).toBe(3);
    });

    it('emits pulumi IaC output', async () => {
      const result = await iaCHandler.emit!(
        { plan: 'myapp', provider: 'pulumi' },
        storage,
      );
      expect(result.variant).toBe('ok');
      expect(result.output).toBe('pulumi/myapp');
      expect(result.fileCount).toBe(3);
    });

    it('emits cloudformation IaC output', async () => {
      const result = await iaCHandler.emit!(
        { plan: 'myapp', provider: 'cloudformation' },
        storage,
      );
      expect(result.variant).toBe('ok');
      expect(result.output).toBe('cloudformation/myapp');
      expect(result.fileCount).toBe(1);
    });

    it('emits docker-compose IaC output', async () => {
      const result = await iaCHandler.emit!(
        { plan: 'myapp', provider: 'docker-compose' },
        storage,
      );
      expect(result.variant).toBe('ok');
      expect(result.output).toBe('docker-compose/myapp');
      expect(result.fileCount).toBe(2);
    });

    it('returns unsupportedResource for unknown provider', async () => {
      const result = await iaCHandler.emit!(
        { plan: 'myapp', provider: 'unknown' },
        storage,
      );
      expect(result.variant).toBe('unsupportedResource');
    });
  });

  describe('preview', () => {
    it('reports resources to create when no state exists', async () => {
      const result = await iaCHandler.preview!(
        { plan: 'myapp', provider: 'terraform' },
        storage,
      );
      expect(result.variant).toBe('ok');
      expect((result.toCreate as string[]).length).toBeGreaterThan(0);
      expect((result.toUpdate as string[]).length).toBe(0);
    });

    it('reports no changes when state already exists', async () => {
      await iaCHandler.emit!(
        { plan: 'myapp', provider: 'terraform' },
        storage,
      );
      const result = await iaCHandler.preview!(
        { plan: 'myapp', provider: 'terraform' },
        storage,
      );
      expect(result.variant).toBe('ok');
      expect((result.toCreate as string[]).length).toBe(0);
    });
  });

  describe('apply', () => {
    it('creates resources on first apply', async () => {
      const result = await iaCHandler.apply!(
        { plan: 'myapp', provider: 'terraform' },
        storage,
      );
      expect(result.variant).toBe('ok');
      expect((result.created as string[]).length).toBeGreaterThan(0);
    });

    it('updates existing resources on subsequent apply', async () => {
      await iaCHandler.emit!(
        { plan: 'myapp', provider: 'terraform' },
        storage,
      );
      const result = await iaCHandler.apply!(
        { plan: 'myapp', provider: 'terraform' },
        storage,
      );
      expect(result.variant).toBe('ok');
      expect((result.updated as string[]).length).toBeGreaterThan(0);
      expect((result.created as string[]).length).toBe(0);
    });
  });

  describe('detectDrift', () => {
    it('returns noDrift when no resources exist', async () => {
      const result = await iaCHandler.detectDrift!(
        { provider: 'terraform' },
        storage,
      );
      expect(result.variant).toBe('noDrift');
    });

    it('returns noDrift when no resources have drifted', async () => {
      await iaCHandler.emit!(
        { plan: 'myapp', provider: 'terraform' },
        storage,
      );
      const result = await iaCHandler.detectDrift!(
        { provider: 'terraform' },
        storage,
      );
      expect(result.variant).toBe('noDrift');
    });

    it('detects drifted resources', async () => {
      await iaCHandler.emit!(
        { plan: 'myapp', provider: 'terraform' },
        storage,
      );
      // Manually mark a resource as drifted
      const resources = await storage.find('ia-c', { provider: 'terraform' });
      for (const r of resources) {
        await storage.put('ia-c', r.id as string, { ...r, driftDetected: true });
      }

      const result = await iaCHandler.detectDrift!(
        { provider: 'terraform' },
        storage,
      );
      expect(result.variant).toBe('ok');
      expect((result.drifted as string[]).length).toBeGreaterThan(0);
    });
  });

  describe('teardown', () => {
    it('tears down all resources for a plan/provider', async () => {
      await iaCHandler.emit!(
        { plan: 'myapp', provider: 'terraform' },
        storage,
      );
      const result = await iaCHandler.teardown!(
        { plan: 'myapp', provider: 'terraform' },
        storage,
      );
      expect(result.variant).toBe('ok');
      expect((result.destroyed as string[]).length).toBeGreaterThan(0);

      // Verify resources are removed
      const remaining = await storage.find('ia-c', { plan: 'myapp', provider: 'terraform' });
      expect(remaining.length).toBe(0);
    });

    it('returns ok with empty destroyed when no resources exist', async () => {
      const result = await iaCHandler.teardown!(
        { plan: 'nonexistent', provider: 'terraform' },
        storage,
      );
      expect(result.variant).toBe('ok');
      expect((result.destroyed as string[]).length).toBe(0);
    });
  });
});
