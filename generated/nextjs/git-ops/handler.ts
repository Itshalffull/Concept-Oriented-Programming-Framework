// GitOps — Declarative Git operations and reconciliation management.
// Emits Kubernetes-style GitOps manifests for supported controllers (Flux,
// ArgoCD), persists them to storage, and tracks reconciliation status for
// each manifest through its lifecycle (pending, reconciled, failed).

import * as TE from 'fp-ts/TaskEither';
import * as O from 'fp-ts/Option';
import { pipe } from 'fp-ts/function';

import type {
  GitOpsStorage,
  GitOpsEmitInput,
  GitOpsEmitOutput,
  GitOpsReconciliationStatusInput,
  GitOpsReconciliationStatusOutput,
} from './types.js';

import {
  emitOk,
  emitControllerUnsupported,
  reconciliationStatusOk,
  reconciliationStatusPending,
  reconciliationStatusFailed,
} from './types.js';

export interface GitOpsError {
  readonly code: string;
  readonly message: string;
}

export interface GitOpsHandler {
  readonly emit: (
    input: GitOpsEmitInput,
    storage: GitOpsStorage,
  ) => TE.TaskEither<GitOpsError, GitOpsEmitOutput>;
  readonly reconciliationStatus: (
    input: GitOpsReconciliationStatusInput,
    storage: GitOpsStorage,
  ) => TE.TaskEither<GitOpsError, GitOpsReconciliationStatusOutput>;
}

// --- Pure helpers ---

const storageError = (error: unknown): GitOpsError => ({
  code: 'STORAGE_ERROR',
  message: error instanceof Error ? error.message : String(error),
});

/** Supported GitOps controllers and their manifest API versions. */
const CONTROLLER_API_VERSIONS: Readonly<Record<string, string>> = {
  flux: 'source.toolkit.fluxcd.io/v1',
  argocd: 'argoproj.io/v1alpha1',
  'argo-cd': 'argoproj.io/v1alpha1',
};

/** Build a deterministic manifest ID from the plan and repo. */
const makeManifestId = (plan: string, repo: string): string =>
  `gitops:${plan}:${repo}`;

/** Build the set of files a GitOps manifest produces. */
const buildManifestFiles = (
  plan: string,
  controller: string,
  path: string,
): readonly string[] => {
  const base = path.endsWith('/') ? path : `${path}/`;
  return [
    `${base}${plan}-kustomization.yaml`,
    `${base}${plan}-source.yaml`,
    ...(controller === 'argocd' || controller === 'argo-cd'
      ? [`${base}${plan}-application.yaml`]
      : []),
  ];
};

// --- Implementation ---

export const gitOpsHandler: GitOpsHandler = {
  emit: (input, storage) =>
    pipe(
      TE.tryCatch(
        async () => {
          const { plan, controller, repo, path } = input;

          // Validate the controller is supported
          const apiVersion = CONTROLLER_API_VERSIONS[controller.toLowerCase()];
          if (apiVersion === undefined) {
            return emitControllerUnsupported(controller);
          }

          const manifestId = makeManifestId(plan, repo);
          const files = buildManifestFiles(plan, controller.toLowerCase(), path);

          // Persist the manifest record with its metadata
          await storage.put('manifests', manifestId, {
            plan,
            controller: controller.toLowerCase(),
            apiVersion,
            repo,
            path,
            files: [...files],
            status: 'pending',
            emittedAt: new Date().toISOString(),
          });

          // Initialise reconciliation tracking
          // ArgoCD controllers auto-sync immediately; Flux requires manual sync cycle
          const isAutoSync = controller.toLowerCase() === 'argocd' || controller.toLowerCase() === 'argo-cd';
          const now = new Date().toISOString();
          await storage.put('reconciliation', manifestId, {
            manifestId,
            status: isAutoSync ? 'synced' : 'pending',
            ...(isAutoSync ? { reconciledAt: now } : { waitingOn: ['awaiting controller sync'] }),
            lastChecked: now,
          });

          return emitOk(manifestId, files);
        },
        storageError,
      ),
    ),

  reconciliationStatus: (input, storage) =>
    pipe(
      TE.tryCatch(
        async () => {
          const record = await storage.get('reconciliation', input.manifest);

          return pipe(
            O.fromNullable(record),
            O.fold(
              // No reconciliation record means the manifest was never emitted
              () =>
                reconciliationStatusFailed(
                  input.manifest,
                  `No reconciliation record found for manifest '${input.manifest}'`,
                ),
              (rec) => {
                const status = (rec['status'] as string) ?? 'unknown';
                const waitingOn = (rec['waitingOn'] as readonly string[]) ?? [];

                if (status === 'reconciled' || status === 'ok' || status === 'synced') {
                  const reconciledAt = rec['reconciledAt']
                    ? new Date(rec['reconciledAt'] as string)
                    : new Date();
                  return reconciliationStatusOk(input.manifest, status, reconciledAt);
                }

                if (status === 'failed') {
                  const reason = (rec['reason'] as string) ?? 'Unknown failure';
                  return reconciliationStatusFailed(input.manifest, reason);
                }

                // Default to pending with any outstanding resources
                return reconciliationStatusPending(
                  input.manifest,
                  waitingOn.length > 0 ? waitingOn : ['awaiting controller sync'],
                );
              },
            ),
          );
        },
        storageError,
      ),
    ),
};
