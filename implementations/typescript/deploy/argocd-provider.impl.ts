// ArgoCDProvider Concept Implementation
// ArgoCD GitOps provider. Generates ArgoCD Application CRDs, manages
// sync waves, and tracks reconciliation status.
import type { ConceptHandler } from '../../../kernel/src/types.js';

const RELATION = 'argocd';

export const argoCDProviderHandler: ConceptHandler = {
  async emit(input, storage) {
    const plan = input.plan as string;
    const repo = input.repo as string;
    const path = input.path as string;

    const applicationId = `app-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    const files = ['application.yaml'];

    await storage.put(RELATION, applicationId, {
      application: applicationId,
      plan,
      repo,
      path,
      files: JSON.stringify(files),
      syncStatus: 'OutOfSync',
      healthStatus: 'Missing',
      status: 'emitted',
      createdAt: new Date().toISOString(),
    });

    return { variant: 'ok', application: applicationId, files };
  },

  async reconciliationStatus(input, storage) {
    const application = input.application as string;

    const record = await storage.get(RELATION, application);
    if (!record) {
      return { variant: 'failed', application, reason: 'Application not found' };
    }

    const reconciledAt = new Date();

    await storage.put(RELATION, application, {
      ...record,
      syncStatus: 'Synced',
      healthStatus: 'Healthy',
      reconciledAt: reconciledAt.toISOString(),
    });

    return {
      variant: 'ok',
      application,
      syncStatus: 'Synced',
      healthStatus: 'Healthy',
      reconciledAt,
    };
  },

  async syncWave(input, storage) {
    const application = input.application as string;
    const wave = input.wave as number;

    const record = await storage.get(RELATION, application);
    if (record) {
      await storage.put(RELATION, application, {
        ...record,
        syncWave: wave,
      });
    }

    return { variant: 'ok', application };
  },
};
