// ============================================================
// GitOps Handler Tests
//
// Coordinate manifest generation for GitOps controllers with
// reconciliation status tracking and drift detection.
// ============================================================

import { describe, it, expect, beforeEach } from 'vitest';
import { createInMemoryStorage } from '../runtime/adapters/storage.js';
import {
  gitOpsHandler,
  resetGitOpsCounter,
} from '../handlers/ts/git-ops.handler.js';

describe('GitOps', () => {
  let storage: ReturnType<typeof createInMemoryStorage>;

  beforeEach(() => {
    storage = createInMemoryStorage();
    resetGitOpsCounter();
  });

  describe('emit', () => {
    it('emits manifests for argocd controller', async () => {
      const result = await gitOpsHandler.emit!(
        { plan: 'myapp', controller: 'argocd', repo: 'https://github.com/org/repo', path: 'k8s' },
        storage,
      );
      expect(result.variant).toBe('ok');
      expect(result.manifest).toBe('git-ops-1');
      expect(result.files).toContain('k8s/myapp-manifest.yaml');
      expect(result.files).toContain('k8s/kustomization.yaml');
    });

    it('emits manifests for flux controller', async () => {
      const result = await gitOpsHandler.emit!(
        { plan: 'staging', controller: 'flux', repo: 'repo', path: 'deploy' },
        storage,
      );
      expect(result.variant).toBe('ok');
      expect(result.files.length).toBe(2);
    });

    it('returns controllerUnsupported for unknown controller', async () => {
      const result = await gitOpsHandler.emit!(
        { plan: 'test', controller: 'unknown', repo: 'repo', path: 'path' },
        storage,
      );
      expect(result.variant).toBe('controllerUnsupported');
    });

    it('stores manifest metadata in storage', async () => {
      await gitOpsHandler.emit!(
        { plan: 'test', controller: 'argocd', repo: 'repo', path: 'k8s' },
        storage,
      );
      const stored = await storage.get('git-ops', 'git-ops-1');
      expect(stored).not.toBeNull();
      expect(stored!.status).toBe('committed');
      expect(stored!.controller).toBe('argocd');
    });
  });

  describe('reconciliationStatus', () => {
    it('returns pending for newly emitted manifests', async () => {
      await gitOpsHandler.emit!(
        { plan: 'test', controller: 'argocd', repo: 'repo', path: 'k8s' },
        storage,
      );
      const result = await gitOpsHandler.reconciliationStatus!(
        { manifest: 'git-ops-1' },
        storage,
      );
      expect(result.variant).toBe('pending');
      expect(result.waitingOn).toContain('controller-sync');
    });

    it('returns failed for non-existent manifest', async () => {
      const result = await gitOpsHandler.reconciliationStatus!(
        { manifest: 'nonexistent' },
        storage,
      );
      expect(result.variant).toBe('failed');
    });

    it('returns ok when status is synced', async () => {
      await gitOpsHandler.emit!(
        { plan: 'test', controller: 'argocd', repo: 'repo', path: 'k8s' },
        storage,
      );
      // Manually update status
      const record = await storage.get('git-ops', 'git-ops-1');
      await storage.put('git-ops', 'git-ops-1', {
        ...record!,
        status: 'synced',
        reconciledAt: new Date().toISOString(),
      });

      const result = await gitOpsHandler.reconciliationStatus!(
        { manifest: 'git-ops-1' },
        storage,
      );
      expect(result.variant).toBe('ok');
      expect(result.status).toBe('synced');
    });

    it('returns failed when status is failed', async () => {
      await gitOpsHandler.emit!(
        { plan: 'test', controller: 'argocd', repo: 'repo', path: 'k8s' },
        storage,
      );
      const record = await storage.get('git-ops', 'git-ops-1');
      await storage.put('git-ops', 'git-ops-1', {
        ...record!,
        status: 'failed',
        failReason: 'Network timeout',
      });

      const result = await gitOpsHandler.reconciliationStatus!(
        { manifest: 'git-ops-1' },
        storage,
      );
      expect(result.variant).toBe('failed');
      expect(result.reason).toContain('Network timeout');
    });
  });
});
