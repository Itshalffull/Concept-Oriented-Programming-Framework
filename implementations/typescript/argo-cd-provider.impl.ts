// ============================================================
// ArgoCDProvider Handler
//
// Generate ArgoCD Application CRDs from COPF deploy plans.
// Owns Application resources, sync wave ordering, health
// assessments, and auto-sync configuration.
// ============================================================

import type { ConceptHandler, ConceptStorage } from '../../kernel/src/types.js';

let idCounter = 0;
function nextId(): string {
  return `argo-cd-provider-${++idCounter}`;
}

export const argoCDProviderHandler: ConceptHandler = {
  async emit(input: Record<string, unknown>, storage: ConceptStorage) {
    const plan = input.plan as string;
    const repo = input.repo as string;
    const path = input.path as string;

    // Derive app name from plan identifier
    const appName = `copf-${plan}`;
    const namespace = 'default';
    const project = 'default';

    // Generate ArgoCD Application CRD YAML
    const applicationCrd = {
      apiVersion: 'argoproj.io/v1alpha1',
      kind: 'Application',
      metadata: {
        name: appName,
        namespace: 'argocd',
      },
      spec: {
        project,
        source: {
          repoURL: repo,
          targetRevision: 'HEAD',
          path,
        },
        destination: {
          server: 'https://kubernetes.default.svc',
          namespace,
        },
        syncPolicy: {
          automated: {
            prune: true,
            selfHeal: true,
          },
        },
      },
    };

    const crdContent = JSON.stringify(applicationCrd, null, 2);
    const crdFileName = `${appName}-application.yaml`;

    const id = nextId();
    const now = new Date().toISOString();
    await storage.put('argo-cd-provider', id, {
      id,
      appName,
      project,
      repoUrl: repo,
      targetRevision: 'HEAD',
      path,
      namespace,
      syncStatus: 'OutOfSync',
      healthStatus: 'Missing',
      syncWave: null,
      lastSyncedAt: null,
      plan,
      crdContent,
      createdAt: now,
    });

    return {
      variant: 'ok',
      application: id,
      files: [crdFileName],
    };
  },

  async reconciliationStatus(input: Record<string, unknown>, storage: ConceptStorage) {
    const application = input.application as string;

    const record = await storage.get('argo-cd-provider', application);
    if (!record) {
      return { variant: 'failed', application, reason: `Application '${application}' not found` };
    }

    const syncStatus = record.syncStatus as string;
    const healthStatus = record.healthStatus as string;

    if (syncStatus === 'Synced' && healthStatus === 'Healthy') {
      return {
        variant: 'ok',
        application,
        syncStatus,
        healthStatus,
        reconciledAt: record.lastSyncedAt || new Date().toISOString(),
      };
    }

    if (healthStatus === 'Degraded') {
      return {
        variant: 'degraded',
        application,
        unhealthyResources: [],
      };
    }

    if (syncStatus === 'OutOfSync' || syncStatus === 'Unknown') {
      return {
        variant: 'pending',
        application,
        waitingOn: ['sync'],
      };
    }

    return {
      variant: 'failed',
      application,
      reason: `Sync status: ${syncStatus}, Health: ${healthStatus}`,
    };
  },

  async syncWave(input: Record<string, unknown>, storage: ConceptStorage) {
    const application = input.application as string;
    const wave = input.wave as number;

    const record = await storage.get('argo-cd-provider', application);
    if (!record) {
      return { variant: 'ok', application };
    }

    await storage.put('argo-cd-provider', application, {
      ...record,
      syncWave: wave,
    });

    return { variant: 'ok', application };
  },
};

/** Reset the ID counter. Useful for testing. */
export function resetArgoCDProviderCounter(): void {
  idCounter = 0;
}
