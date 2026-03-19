// ArgoCDProvider Concept Implementation
// Generate ArgoCD Application CRDs from Clef deploy plans. Owns Application
// resources, sync wave ordering, health assessments, and auto-sync configuration.
import type { ConceptHandler } from '@clef/runtime';

export const argocdProviderHandler: ConceptHandler = {
  async register() {
    return {
      variant: 'ok',
      name: 'ArgoCDProvider',
      inputKind: 'DeployPlan',
      outputKind: 'ArgoCDManifest',
      capabilities: JSON.stringify(['application-crd', 'kustomization', 'sync-wave']),
      providerKey: 'argocd',
      providerType: 'gitops',
    };
  },

  async emit(input, storage) {
    const plan = input.plan as string;
    const repo = input.repo as string;
    const path = input.path as string;

    const applicationId = `argocd-app-${plan}-${Date.now()}`;
    const appName = `app-${plan}`;
    const files = [
      `${path}/application.yaml`,
      `${path}/kustomization.yaml`,
    ];

    await storage.put('application', applicationId, {
      appName,
      project: 'default',
      repoUrl: repo,
      targetRevision: 'HEAD',
      path,
      namespace: 'default',
      syncStatus: 'OutOfSync',
      healthStatus: 'Missing',
      syncWave: null,
      lastSyncedAt: null,
      createdAt: new Date().toISOString(),
    });

    return {
      variant: 'ok',
      application: applicationId,
      files,
    };
  },

  async reconciliationStatus(input, storage) {
    const application = input.application as string;

    const record = await storage.get('application', application);
    if (!record) {
      return {
        variant: 'failed',
        application,
        reason: 'Application not found in storage',
      };
    }

    const syncStatus = record.syncStatus as string;
    const healthStatus = record.healthStatus as string;

    if (syncStatus === 'Synced' && healthStatus === 'Healthy') {
      const reconciledAt = new Date().toISOString();
      await storage.put('application', application, {
        ...record,
        lastSyncedAt: reconciledAt,
      });
      return {
        variant: 'ok',
        application,
        syncStatus,
        healthStatus,
        reconciledAt,
      };
    }

    if (syncStatus === 'OutOfSync' || syncStatus === 'Unknown') {
      // Simulate sync progressing
      await storage.put('application', application, {
        ...record,
        syncStatus: 'Synced',
        healthStatus: 'Healthy',
      });
      return {
        variant: 'pending',
        application,
        waitingOn: ['deployment', 'service'],
      };
    }

    if (healthStatus === 'Degraded') {
      return {
        variant: 'degraded',
        application,
        unhealthyResources: ['pod/app-0', 'pod/app-1'],
      };
    }

    return {
      variant: 'failed',
      application,
      reason: `Sync failed with status: ${syncStatus}`,
    };
  },

  async syncWave(input, storage) {
    const application = input.application as string;
    const wave = input.wave as number;

    const record = await storage.get('application', application);
    if (record) {
      await storage.put('application', application, {
        ...record,
        syncWave: wave,
      });
    }

    return {
      variant: 'ok',
      application,
    };
  },
};
