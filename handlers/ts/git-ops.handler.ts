// @migrated dsl-constructs 2026-03-18
// ============================================================
// GitOps Handler
//
// Coordinate manifest generation for GitOps controllers.
// ============================================================

import type { FunctionalConceptHandler } from '../../runtime/functional-handler.ts';
import {
  createProgram, get, put, branch, complete, completeFrom,
  type StorageProgram,
} from '../../runtime/storage-program.ts';
import { autoInterpret } from '../../runtime/functional-compat.ts';

type Result = { variant: string; [key: string]: unknown };

let idCounter = 0;
function nextId(): string { return `git-ops-${++idCounter}`; }

const SUPPORTED_CONTROLLERS = ['argocd', 'flux', 'custom'];

const _handler: FunctionalConceptHandler = {
  emit(input: Record<string, unknown>) {
    const plan = input.plan as string;
    const controller = input.controller as string;
    const repo = input.repo as string;
    const path = input.path as string;

    if (!SUPPORTED_CONTROLLERS.includes(controller)) {
      const p = createProgram();
      return complete(p, 'controllerUnsupported', { controller }) as StorageProgram<Result>;
    }

    const manifestFile = `${path}/${plan}-manifest.yaml`;
    const kustomizationFile = `${path}/kustomization.yaml`;
    const files = [manifestFile, kustomizationFile];

    const id = nextId();
    const now = new Date().toISOString();

    let p = createProgram();
    p = put(p, 'git-ops', id, {
      id, plan, controller,
      repoPath: `${repo}:${path}`,
      committedAt: now, reconciledAt: null, status: 'committed',
    });

    return complete(p, 'ok', { manifest: id, files }) as StorageProgram<Result>;
  },

  reconciliationStatus(input: Record<string, unknown>) {
    const manifest = input.manifest as string;

    let p = createProgram();
    p = get(p, 'git-ops', manifest, 'record');

    return branch(p, 'record',
      (thenP) => completeFrom(thenP, '', (bindings) => {
        const record = bindings.record as Record<string, unknown>;
        const status = record.status as string;

        if (status === 'synced' || status === 'reconciled') {
          return { variant: 'ok', manifest, status: 'synced', reconciledAt: record.reconciledAt || new Date().toISOString() };
        }
        if (status === 'failed') {
          return { variant: 'failed', manifest, reason: (record.failReason as string) || 'Reconciliation failed' };
        }
        return { variant: 'pending', manifest, waitingOn: ['controller-sync'] };
      }),
      (elseP) => complete(elseP, 'failed', { manifest, reason: `Manifest '${manifest}' not found` }),
    ) as StorageProgram<Result>;
  },
};

export const gitOpsHandler = autoInterpret(_handler);

/** Reset the ID counter. Useful for testing. */
export function resetGitOpsCounter(): void { idCounter = 0; }
