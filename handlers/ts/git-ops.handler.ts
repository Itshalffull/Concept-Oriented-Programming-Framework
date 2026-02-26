// ============================================================
// GitOps Handler
//
// Coordinate manifest generation for GitOps controllers. Owns
// the manifest registry tracking what has been pushed to the
// deploy repo, reconciliation status tracking, and drift
// detection from the controller perspective.
// ============================================================

import type { ConceptHandler, ConceptStorage } from '../../kernel/src/types.js';

let idCounter = 0;
function nextId(): string {
  return `git-ops-${++idCounter}`;
}

const SUPPORTED_CONTROLLERS = ['argocd', 'flux', 'custom'];

export const gitOpsHandler: ConceptHandler = {
  async emit(input: Record<string, unknown>, storage: ConceptStorage) {
    const plan = input.plan as string;
    const controller = input.controller as string;
    const repo = input.repo as string;
    const path = input.path as string;

    if (!SUPPORTED_CONTROLLERS.includes(controller)) {
      return { variant: 'controllerUnsupported', controller };
    }

    // Generate manifest file names based on plan and controller
    const manifestFile = `${path}/${plan}-manifest.yaml`;
    const kustomizationFile = `${path}/kustomization.yaml`;
    const files = [manifestFile, kustomizationFile];

    const id = nextId();
    const now = new Date().toISOString();

    await storage.put('git-ops', id, {
      id,
      plan,
      controller,
      repoPath: `${repo}:${path}`,
      committedAt: now,
      reconciledAt: null,
      status: 'committed',
    });

    return {
      variant: 'ok',
      manifest: id,
      files,
    };
  },

  async reconciliationStatus(input: Record<string, unknown>, storage: ConceptStorage) {
    const manifest = input.manifest as string;

    const record = await storage.get('git-ops', manifest);
    if (!record) {
      return { variant: 'failed', manifest, reason: `Manifest '${manifest}' not found` };
    }

    const status = record.status as string;

    if (status === 'synced' || status === 'reconciled') {
      return {
        variant: 'ok',
        manifest,
        status: 'synced',
        reconciledAt: record.reconciledAt || new Date().toISOString(),
      };
    }

    if (status === 'failed') {
      return {
        variant: 'failed',
        manifest,
        reason: (record.failReason as string) || 'Reconciliation failed',
      };
    }

    // Default: still pending
    return {
      variant: 'pending',
      manifest,
      waitingOn: ['controller-sync'],
    };
  },
};

/** Reset the ID counter. Useful for testing. */
export function resetGitOpsCounter(): void {
  idCounter = 0;
}
