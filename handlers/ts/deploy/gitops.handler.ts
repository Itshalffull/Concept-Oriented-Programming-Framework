// GitOps Concept Implementation
// GitOps manifest generation and reconciliation tracking. Emits
// controller-specific manifests (ArgoCD, Flux) and monitors sync status.
import type { ConceptHandler } from '../../../runtime/types.js';

const RELATION = 'gitops';
const SUPPORTED_CONTROLLERS = ['argocd', 'flux'];

export const gitopsHandler: ConceptHandler = {
  async emit(input, storage) {
    const plan = input.plan as string;
    const controller = input.controller as string;
    const repo = input.repo as string;
    const path = input.path as string;

    if (!SUPPORTED_CONTROLLERS.includes(controller)) {
      return { variant: 'controllerUnsupported', controller };
    }

    const manifestId = `go-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    const files = [
      `${path}/${controller}-application.yaml`,
      `${path}/${controller}-project.yaml`,
    ];

    // Store concept state only — file output is routed through Emitter via syncs
    await storage.put(RELATION, manifestId, {
      manifest: manifestId,
      plan,
      controller,
      repo,
      path,
      status: 'pending',
      createdAt: new Date().toISOString(),
    });

    return { variant: 'ok', manifest: manifestId, files };
  },

  async reconciliationStatus(input, storage) {
    const manifest = input.manifest as string;

    const record = await storage.get(RELATION, manifest);
    if (!record) {
      return { variant: 'failed', manifest, reason: 'Manifest not found' };
    }

    const status = record.status as string;
    if (status === 'pending') {
      return { variant: 'pending', manifest, waitingOn: ['sync'] };
    }

    return {
      variant: 'ok',
      manifest,
      status: 'synced',
      reconciledAt: new Date(),
    };
  },
};
