// ============================================================
// ArgoCDProvider Handler Tests
//
// Generate ArgoCD Application CRDs from COPF deploy plans.
// ============================================================

import { describe, it, expect, beforeEach } from 'vitest';
import { createInMemoryStorage } from '../kernel/src/storage.js';
import {
  argoCDProviderHandler,
  resetArgoCDProviderCounter,
} from '../handlers/ts/argo-cd-provider.handler.js';

describe('ArgoCDProvider', () => {
  let storage: ReturnType<typeof createInMemoryStorage>;

  beforeEach(() => {
    storage = createInMemoryStorage();
    resetArgoCDProviderCounter();
  });

  describe('emit', () => {
    it('generates an ArgoCD Application CRD', async () => {
      const result = await argoCDProviderHandler.emit!(
        { plan: 'myapp', repo: 'https://github.com/org/repo', path: 'k8s/' },
        storage,
      );
      expect(result.variant).toBe('ok');
      expect(result.application).toBe('argo-cd-provider-1');
      expect(result.files).toContain('copf-myapp-application.yaml');
    });

    it('stores application metadata in storage', async () => {
      await argoCDProviderHandler.emit!(
        { plan: 'staging', repo: 'https://github.com/org/repo', path: 'deploy/' },
        storage,
      );
      const stored = await storage.get('argo-cd-provider', 'argo-cd-provider-1');
      expect(stored).not.toBeNull();
      expect(stored!.appName).toBe('copf-staging');
      expect(stored!.syncStatus).toBe('OutOfSync');
      expect(stored!.healthStatus).toBe('Missing');
    });

    it('generates valid CRD JSON content', async () => {
      await argoCDProviderHandler.emit!(
        { plan: 'test', repo: 'https://github.com/org/repo', path: 'k8s/' },
        storage,
      );
      const stored = await storage.get('argo-cd-provider', 'argo-cd-provider-1');
      const crd = JSON.parse(stored!.crdContent as string);
      expect(crd.apiVersion).toBe('argoproj.io/v1alpha1');
      expect(crd.kind).toBe('Application');
      expect(crd.spec.source.repoURL).toBe('https://github.com/org/repo');
      expect(crd.spec.syncPolicy.automated.prune).toBe(true);
    });
  });

  describe('reconciliationStatus', () => {
    it('returns pending for newly emitted applications', async () => {
      const emitResult = await argoCDProviderHandler.emit!(
        { plan: 'test', repo: 'repo', path: 'path' },
        storage,
      );

      const result = await argoCDProviderHandler.reconciliationStatus!(
        { application: emitResult.application as string },
        storage,
      );
      expect(result.variant).toBe('pending');
      expect(result.waitingOn).toContain('sync');
    });

    it('returns failed for non-existent application', async () => {
      const result = await argoCDProviderHandler.reconciliationStatus!(
        { application: 'nonexistent' },
        storage,
      );
      expect(result.variant).toBe('failed');
    });

    it('returns ok when sync and health are good', async () => {
      await argoCDProviderHandler.emit!(
        { plan: 'test', repo: 'repo', path: 'path' },
        storage,
      );
      // Manually update status to simulate reconciliation
      const record = await storage.get('argo-cd-provider', 'argo-cd-provider-1');
      await storage.put('argo-cd-provider', 'argo-cd-provider-1', {
        ...record!,
        syncStatus: 'Synced',
        healthStatus: 'Healthy',
      });

      const result = await argoCDProviderHandler.reconciliationStatus!(
        { application: 'argo-cd-provider-1' },
        storage,
      );
      expect(result.variant).toBe('ok');
      expect(result.syncStatus).toBe('Synced');
      expect(result.healthStatus).toBe('Healthy');
    });

    it('returns degraded when health is Degraded', async () => {
      await argoCDProviderHandler.emit!(
        { plan: 'test', repo: 'repo', path: 'path' },
        storage,
      );
      const record = await storage.get('argo-cd-provider', 'argo-cd-provider-1');
      await storage.put('argo-cd-provider', 'argo-cd-provider-1', {
        ...record!,
        syncStatus: 'Synced',
        healthStatus: 'Degraded',
      });

      const result = await argoCDProviderHandler.reconciliationStatus!(
        { application: 'argo-cd-provider-1' },
        storage,
      );
      expect(result.variant).toBe('degraded');
    });
  });

  describe('syncWave', () => {
    it('sets sync wave on an application', async () => {
      await argoCDProviderHandler.emit!(
        { plan: 'test', repo: 'repo', path: 'path' },
        storage,
      );
      const result = await argoCDProviderHandler.syncWave!(
        { application: 'argo-cd-provider-1', wave: 2 },
        storage,
      );
      expect(result.variant).toBe('ok');

      const stored = await storage.get('argo-cd-provider', 'argo-cd-provider-1');
      expect(stored!.syncWave).toBe(2);
    });

    it('handles non-existent application gracefully', async () => {
      const result = await argoCDProviderHandler.syncWave!(
        { application: 'nonexistent', wave: 1 },
        storage,
      );
      expect(result.variant).toBe('ok');
    });
  });
});
