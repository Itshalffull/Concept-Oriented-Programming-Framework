// @migrated dsl-constructs 2026-03-18
// ArgoCDProvider Concept Implementation
// Generate ArgoCD Application CRDs from Clef deploy plans. Owns Application
// resources, sync wave ordering, health assessments, and auto-sync configuration.
import type { FunctionalConceptHandler } from '../../../runtime/functional-handler.ts';
import {
  createProgram, get as spGet, put, branch, complete,
  type StorageProgram,
} from '../../../runtime/storage-program.ts';

export const argocdProviderHandler: FunctionalConceptHandler = {
  register(_input: Record<string, unknown>) {
    let p = createProgram();
    return complete(p, 'ok', {
      name: 'ArgoCDProvider',
      inputKind: 'DeployPlan',
      outputKind: 'ArgoCDManifest',
      capabilities: JSON.stringify(['application-crd', 'kustomization', 'sync-wave']),
      providerKey: 'argocd',
      providerType: 'gitops',
    }) as StorageProgram<{ variant: string; [key: string]: unknown }>;
  },

  emit(input: Record<string, unknown>) {
    const plan = input.plan as string;
    const repo = input.repo as string;
    const path = input.path as string;

    const applicationId = `argocd-app-${plan}-${Date.now()}`;
    const appName = `app-${plan}`;
    const files = [
      `${path}/application.yaml`,
      `${path}/kustomization.yaml`,
    ];

    let p = createProgram();
    p = put(p, 'application', applicationId, {
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

    return complete(p, 'ok', { application: applicationId, files }) as StorageProgram<{ variant: string; [key: string]: unknown }>;
  },

  reconciliationStatus(input: Record<string, unknown>) {
    const application = input.application as string;

    let p = createProgram();
    p = spGet(p, 'application', application, 'record');
    p = branch(p, 'record',
      (b) => {
        // Runtime resolves syncStatus/healthStatus from binding and branches accordingly
        // Simplified: return ok with placeholder values resolved at runtime
        return complete(b, 'ok', {
          application,
          syncStatus: '',
          healthStatus: '',
          reconciledAt: '',
        });
      },
      (b) => complete(b, 'failed', {
        application,
        reason: 'Application not found in storage',
      }),
    );
    return p as StorageProgram<{ variant: string; [key: string]: unknown }>;
  },

  syncWave(input: Record<string, unknown>) {
    const application = input.application as string;
    const wave = input.wave as number;

    let p = createProgram();
    p = spGet(p, 'application', application, 'record');
    p = branch(p, 'record',
      (b) => {
        let b2 = put(b, 'application', application, { syncWave: wave });
        return complete(b2, 'ok', { application });
      },
      (b) => complete(b, 'ok', { application }),
    );
    return p as StorageProgram<{ variant: string; [key: string]: unknown }>;
  },
};
