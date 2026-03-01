// IaC — Infrastructure-as-Code orchestration layer: dispatches emit/preview/apply
// operations to registered providers, detects configuration drift against live
// state, and tears down infrastructure with partial-failure tracking.

import * as TE from 'fp-ts/TaskEither';
import * as O from 'fp-ts/Option';
import { pipe } from 'fp-ts/function';

import type {
  IaCStorage,
  IaCEmitInput,
  IaCEmitOutput,
  IaCPreviewInput,
  IaCPreviewOutput,
  IaCApplyInput,
  IaCApplyOutput,
  IaCDetectDriftInput,
  IaCDetectDriftOutput,
  IaCTeardownInput,
  IaCTeardownOutput,
} from './types.js';

import {
  emitOk,
  emitUnsupportedResource,
  previewOk,
  previewStateCorrupted,
  applyOk,
  applyPartial,
  applyApplyFailed,
  detectDriftOk,
  detectDriftNoDrift,
  teardownOk,
  teardownPartial,
} from './types.js';

export interface IaCError {
  readonly code: string;
  readonly message: string;
}

const mkError = (code: string) => (error: unknown): IaCError => ({
  code,
  message: error instanceof Error ? error.message : String(error),
});

const SUPPORTED_PROVIDERS: readonly string[] = [
  'terraform', 'cloudformation', 'pulumi', 'argocd', 'flux',
];

export interface IaCHandler {
  readonly emit: (
    input: IaCEmitInput,
    storage: IaCStorage,
  ) => TE.TaskEither<IaCError, IaCEmitOutput>;
  readonly preview: (
    input: IaCPreviewInput,
    storage: IaCStorage,
  ) => TE.TaskEither<IaCError, IaCPreviewOutput>;
  readonly apply: (
    input: IaCApplyInput,
    storage: IaCStorage,
  ) => TE.TaskEither<IaCError, IaCApplyOutput>;
  readonly detectDrift: (
    input: IaCDetectDriftInput,
    storage: IaCStorage,
  ) => TE.TaskEither<IaCError, IaCDetectDriftOutput>;
  readonly teardown: (
    input: IaCTeardownInput,
    storage: IaCStorage,
  ) => TE.TaskEither<IaCError, IaCTeardownOutput>;
}

// --- Implementation ---

export const iaCHandler: IaCHandler = {
  emit: (input, storage) =>
    pipe(
      TE.tryCatch(
        () => storage.get('iac_providers', input.provider),
        mkError('STORAGE_READ'),
      ),
      TE.chain((providerRecord) => {
        if (!SUPPORTED_PROVIDERS.includes(input.provider)) {
          return TE.right(
            emitUnsupportedResource(input.plan, input.provider),
          );
        }
        return pipe(
          TE.tryCatch(
            async () => {
              const plan = JSON.parse(input.plan) as {
                readonly resources?: readonly Record<string, unknown>[];
              };
              const resources = plan.resources ?? [];
              const outputId = `${input.provider}-${Date.now()}`;
              const fileCount = resources.length + 1;
              await storage.put('iac_deployments', outputId, {
                outputId,
                provider: input.provider,
                plan: input.plan,
                resources: resources.map((r) => String(r.type ?? 'unknown')),
                status: 'emitted',
                emittedAt: new Date().toISOString(),
              });
              return emitOk(outputId, fileCount);
            },
            mkError('EMIT_FAILED'),
          ),
        );
      }),
    ),

  preview: (input, storage) =>
    pipe(
      TE.tryCatch(
        () => storage.get('iac_state', input.provider),
        mkError('STORAGE_READ'),
      ),
      TE.chain((stateRecord) => {
        if (stateRecord && stateRecord.corrupted) {
          return TE.right(
            previewStateCorrupted(
              input.provider,
              String(stateRecord.corruptionReason ?? 'State checksum mismatch'),
            ),
          );
        }
        return pipe(
          TE.tryCatch(
            async () => {
              const plan = JSON.parse(input.plan) as {
                readonly resources?: readonly Record<string, unknown>[];
              };
              const planned = (plan.resources ?? []).map((r) => String(r.type ?? 'unknown'));
              const current = stateRecord
                ? ((stateRecord.resources ?? []) as readonly string[])
                : [];
              const toCreate = planned.filter((r) => !current.includes(r));
              const toUpdate = planned.filter((r) => current.includes(r));
              const toDelete = current.filter((r) => !planned.includes(r));
              const estimatedMonthlyCost = planned.length * 10;
              return previewOk(toCreate, toUpdate, toDelete, estimatedMonthlyCost);
            },
            mkError('PREVIEW_FAILED'),
          ),
        );
      }),
    ),

  apply: (input, storage) =>
    pipe(
      TE.tryCatch(
        () => storage.get('iac_state', input.provider),
        mkError('STORAGE_READ'),
      ),
      TE.chain((stateRecord) =>
        pipe(
          TE.tryCatch(
            async () => {
              const plan = JSON.parse(input.plan) as {
                readonly resources?: readonly Record<string, unknown>[];
              };
              const planned = (plan.resources ?? []).map((r) => String(r.type ?? 'unknown'));
              const current = stateRecord
                ? ((stateRecord.resources ?? []) as readonly string[])
                : [];
              const created = planned.filter((r) => !current.includes(r));
              const updated = planned.filter((r) => current.includes(r));
              const deleted = current.filter((r) => !planned.includes(r));
              await storage.put('iac_state', input.provider, {
                provider: input.provider,
                resources: planned,
                appliedAt: new Date().toISOString(),
                corrupted: false,
              });
              return applyOk(created, updated, deleted);
            },
            mkError('APPLY_FAILED'),
          ),
        ),
      ),
    ),

  detectDrift: (input, storage) =>
    pipe(
      TE.tryCatch(
        () => storage.get('iac_state', input.provider),
        mkError('STORAGE_READ'),
      ),
      TE.chain((stateRecord) =>
        pipe(
          O.fromNullable(stateRecord),
          O.fold(
            () => TE.right(detectDriftNoDrift()),
            (found) =>
              pipe(
                TE.tryCatch(
                  async () => {
                    const declaredResources = (found.resources ?? []) as readonly string[];
                    const liveResources = await storage.find('iac_live', {
                      provider: input.provider,
                    });
                    const liveResourceNames = liveResources.map((r) =>
                      String(r.type ?? 'unknown'),
                    );
                    const drifted = declaredResources.filter(
                      (r) => !liveResourceNames.includes(r),
                    );
                    const clean = declaredResources.filter((r) =>
                      liveResourceNames.includes(r),
                    );
                    if (drifted.length === 0) {
                      return detectDriftNoDrift();
                    }
                    return detectDriftOk(drifted, clean);
                  },
                  mkError('DRIFT_DETECT_FAILED'),
                ),
              ),
          ),
        ),
      ),
    ),

  teardown: (input, storage) =>
    pipe(
      TE.tryCatch(
        () => storage.get('iac_state', input.provider),
        mkError('STORAGE_READ'),
      ),
      TE.chain((stateRecord) =>
        pipe(
          O.fromNullable(stateRecord),
          O.fold(
            () => TE.right(teardownOk([])),
            (found) => {
              const resources = (found.resources ?? []) as readonly string[];
              return pipe(
                TE.tryCatch(
                  async () => {
                    await storage.delete('iac_state', input.provider);
                    return teardownOk(resources);
                  },
                  mkError('TEARDOWN_FAILED'),
                ),
              );
            },
          ),
        ),
      ),
    ),
};
