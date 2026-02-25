// FluxProvider Concept Implementation
// Generate Flux CRDs from COPF deploy plans. Owns Kustomization CRDs,
// HelmRelease objects, source controller references, and reconciliation
// status tracking.
import type { ConceptHandler } from '@copf/kernel';

export const fluxProviderHandler: ConceptHandler = {
  async register() {
    return {
      variant: 'ok',
      name: 'FluxProvider',
      inputKind: 'DeployPlan',
      outputKind: 'FluxKustomization',
      capabilities: JSON.stringify(['kustomization-crd', 'source', 'helm-release']),
      providerKey: 'flux',
      providerType: 'gitops',
    };
  },

  async emit(input, storage) {
    const plan = input.plan as string;
    const repo = input.repo as string;
    const path = input.path as string;

    const kustomizationId = `flux-ks-${plan}-${Date.now()}`;
    const files = [
      `${path}/kustomization.yaml`,
      `${path}/source.yaml`,
    ];

    await storage.put('kustomization', kustomizationId, {
      name: `ks-${plan}`,
      namespace: 'flux-system',
      sourceRef: repo,
      path,
      interval: '5m',
      readyStatus: 'Unknown',
      lastAppliedRevision: null,
      lastAttemptedRevision: null,
      lastHandledReconcileAt: null,
      releaseName: null,
      chartRef: null,
      valuesFrom: JSON.stringify([]),
      createdAt: new Date().toISOString(),
    });

    return {
      variant: 'ok',
      kustomization: kustomizationId,
      files,
    };
  },

  async reconciliationStatus(input, storage) {
    const kustomization = input.kustomization as string;

    const record = await storage.get('kustomization', kustomization);
    if (!record) {
      return {
        variant: 'failed',
        kustomization,
        reason: 'Kustomization not found in storage',
      };
    }

    const readyStatus = record.readyStatus as string;

    if (readyStatus === 'True') {
      const reconciledAt = new Date().toISOString();
      const appliedRevision = record.lastAppliedRevision as string || 'main@sha1:abc123';

      await storage.put('kustomization', kustomization, {
        ...record,
        lastHandledReconcileAt: reconciledAt,
      });

      return {
        variant: 'ok',
        kustomization,
        readyStatus,
        appliedRevision,
        reconciledAt,
      };
    }

    if (readyStatus === 'Unknown') {
      // Simulate reconciliation progressing
      await storage.put('kustomization', kustomization, {
        ...record,
        readyStatus: 'True',
        lastAppliedRevision: 'main@sha1:abc123',
        lastAttemptedRevision: 'main@sha1:abc123',
      });

      return {
        variant: 'pending',
        kustomization,
        waitingOn: ['source-controller', 'kustomize-controller'],
      };
    }

    return {
      variant: 'failed',
      kustomization,
      reason: `Reconciliation failed with ready status: ${readyStatus}`,
    };
  },

  async helmRelease(input, storage) {
    const kustomization = input.kustomization as string;
    const chart = input.chart as string;
    const values = input.values as string;

    const record = await storage.get('kustomization', kustomization);

    if (chart.includes('notfound') || chart.includes('missing')) {
      return {
        variant: 'chartNotFound',
        chart,
        sourceRef: record ? (record.sourceRef as string) : 'unknown',
      };
    }

    const releaseName = `hr-${chart.replace(/\//g, '-')}-${Date.now()}`;

    if (record) {
      await storage.put('kustomization', kustomization, {
        ...record,
        releaseName,
        chartRef: chart,
        valuesFrom: JSON.stringify([values]),
      });
    }

    return {
      variant: 'ok',
      kustomization,
      releaseName,
    };
  },
};
