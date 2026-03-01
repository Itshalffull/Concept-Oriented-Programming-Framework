// GcfRuntime — Google Cloud Functions deployment, trigger config, and version management
// Manages GCF lifecycle: provisioning with Gen2/trigger conflict detection,
// deploying source archives with build validation, traffic splitting, and teardown.

import * as TE from 'fp-ts/TaskEither';
import * as O from 'fp-ts/Option';
import { pipe } from 'fp-ts/function';

import type {
  GcfRuntimeStorage,
  GcfRuntimeProvisionInput,
  GcfRuntimeProvisionOutput,
  GcfRuntimeDeployInput,
  GcfRuntimeDeployOutput,
  GcfRuntimeSetTrafficWeightInput,
  GcfRuntimeSetTrafficWeightOutput,
  GcfRuntimeRollbackInput,
  GcfRuntimeRollbackOutput,
  GcfRuntimeDestroyInput,
  GcfRuntimeDestroyOutput,
} from './types.js';

import {
  provisionOk,
  provisionGen2Required,
  provisionTriggerConflict,
  deployOk,
  deployBuildFailed,
  setTrafficWeightOk,
  rollbackOk,
  destroyOk,
} from './types.js';

export interface GcfRuntimeError {
  readonly code: string;
  readonly message: string;
}

export interface GcfRuntimeHandler {
  readonly provision: (
    input: GcfRuntimeProvisionInput,
    storage: GcfRuntimeStorage,
  ) => TE.TaskEither<GcfRuntimeError, GcfRuntimeProvisionOutput>;
  readonly deploy: (
    input: GcfRuntimeDeployInput,
    storage: GcfRuntimeStorage,
  ) => TE.TaskEither<GcfRuntimeError, GcfRuntimeDeployOutput>;
  readonly setTrafficWeight: (
    input: GcfRuntimeSetTrafficWeightInput,
    storage: GcfRuntimeStorage,
  ) => TE.TaskEither<GcfRuntimeError, GcfRuntimeSetTrafficWeightOutput>;
  readonly rollback: (
    input: GcfRuntimeRollbackInput,
    storage: GcfRuntimeStorage,
  ) => TE.TaskEither<GcfRuntimeError, GcfRuntimeRollbackOutput>;
  readonly destroy: (
    input: GcfRuntimeDestroyInput,
    storage: GcfRuntimeStorage,
  ) => TE.TaskEither<GcfRuntimeError, GcfRuntimeDestroyOutput>;
}

// Trigger types that require Cloud Functions Gen2
const GEN2_REQUIRED_TRIGGERS: readonly string[] = [
  'eventarc', 'cloudsql', 'firebase-alerts', 'custom-events',
];

const toError = (error: unknown): GcfRuntimeError => ({
  code: 'STORAGE_ERROR',
  message: error instanceof Error ? error.message : String(error),
});

// --- Implementation ---

export const gcfRuntimeHandler: GcfRuntimeHandler = {
  provision: (input, storage) =>
    pipe(
      TE.tryCatch(
        () => storage.find('gcf-triggers', { triggerType: input.triggerType, region: input.region }),
        toError,
      ),
      TE.chain((existingTriggers) => {
        // Certain trigger types require Gen2 runtime
        if (GEN2_REQUIRED_TRIGGERS.includes(input.triggerType) && !input.runtime.includes('gen2')) {
          return TE.right<GcfRuntimeError, GcfRuntimeProvisionOutput>(
            provisionGen2Required(
              input.concept,
              `Trigger type "${input.triggerType}" requires Cloud Functions Gen2`,
            ),
          );
        }

        // Check for trigger conflicts in the same region
        const conflict = existingTriggers.find(
          (t) => String((t as Record<string, unknown>).triggerType) === input.triggerType,
        );
        if (conflict) {
          return TE.right<GcfRuntimeError, GcfRuntimeProvisionOutput>(
            provisionTriggerConflict(
              input.triggerType,
              String((conflict as Record<string, unknown>).functionName),
            ),
          );
        }

        const functionName = `gcf-${input.concept}-${input.region}`;
        const endpoint = `https://${input.region}-${input.projectId}.cloudfunctions.net/${functionName}`;

        return TE.tryCatch(
          async () => {
            await storage.put('gcf-functions', functionName, {
              functionName,
              concept: input.concept,
              projectId: input.projectId,
              region: input.region,
              runtime: input.runtime,
              triggerType: input.triggerType,
              endpoint,
              versionCount: 0,
              weight: 100,
              createdAt: new Date().toISOString(),
            });
            await storage.put('gcf-triggers', `${input.region}:${input.triggerType}`, {
              triggerType: input.triggerType,
              region: input.region,
              functionName,
            });
            return provisionOk(functionName, endpoint);
          },
          toError,
        );
      }),
    ),

  deploy: (input, storage) =>
    pipe(
      TE.tryCatch(
        () => storage.get('gcf-functions', input.function),
        toError,
      ),
      TE.chain((record) =>
        pipe(
          O.fromNullable(record),
          O.fold(
            () => TE.left<GcfRuntimeError, GcfRuntimeDeployOutput>({
              code: 'FUNCTION_NOT_FOUND',
              message: `Function ${input.function} does not exist`,
            }),
            (existing) => {
              // Validate source archive path
              if (!input.sourceArchive || input.sourceArchive.trim().length === 0) {
                return TE.right<GcfRuntimeError, GcfRuntimeDeployOutput>(
                  deployBuildFailed(input.function, ['Source archive path is empty']),
                );
              }

              const versionCount = Number((existing as Record<string, unknown>).versionCount ?? 0);
              const version = `v${versionCount + 1}`;

              return TE.tryCatch(
                async () => {
                  await storage.put('gcf-versions', `${input.function}:${version}`, {
                    functionName: input.function,
                    version,
                    sourceArchive: input.sourceArchive,
                    deployedAt: new Date().toISOString(),
                  });
                  await storage.put('gcf-functions', input.function, {
                    ...existing,
                    versionCount: versionCount + 1,
                    activeVersion: version,
                    lastSourceArchive: input.sourceArchive,
                  });
                  return deployOk(input.function, version);
                },
                toError,
              );
            },
          ),
        ),
      ),
    ),

  setTrafficWeight: (input, storage) =>
    pipe(
      TE.tryCatch(
        () => storage.get('gcf-functions', input.function),
        toError,
      ),
      TE.chain((record) =>
        pipe(
          O.fromNullable(record),
          O.fold(
            () => TE.left<GcfRuntimeError, GcfRuntimeSetTrafficWeightOutput>({
              code: 'FUNCTION_NOT_FOUND',
              message: `Function ${input.function} does not exist`,
            }),
            (existing) =>
              TE.tryCatch(
                async () => {
                  const clampedWeight = Math.max(0, Math.min(100, input.weight));
                  await storage.put('gcf-functions', input.function, {
                    ...existing,
                    weight: clampedWeight,
                  });
                  return setTrafficWeightOk(input.function);
                },
                toError,
              ),
          ),
        ),
      ),
    ),

  rollback: (input, storage) =>
    pipe(
      TE.tryCatch(
        () => storage.get('gcf-versions', `${input.function}:${input.targetVersion}`),
        toError,
      ),
      TE.chain((versionRecord) =>
        pipe(
          O.fromNullable(versionRecord),
          O.fold(
            () => TE.left<GcfRuntimeError, GcfRuntimeRollbackOutput>({
              code: 'VERSION_NOT_FOUND',
              message: `Version ${input.targetVersion} not found for ${input.function}`,
            }),
            () =>
              TE.tryCatch(
                async () => {
                  const funcRecord = await storage.get('gcf-functions', input.function);
                  if (funcRecord) {
                    await storage.put('gcf-functions', input.function, {
                      ...funcRecord,
                      activeVersion: input.targetVersion,
                    });
                  }
                  return rollbackOk(input.function, input.targetVersion);
                },
                toError,
              ),
          ),
        ),
      ),
    ),

  destroy: (input, storage) =>
    pipe(
      TE.tryCatch(
        () => storage.get('gcf-functions', input.function),
        toError,
      ),
      TE.chain((record) =>
        pipe(
          O.fromNullable(record),
          O.fold(
            () => TE.left<GcfRuntimeError, GcfRuntimeDestroyOutput>({
              code: 'FUNCTION_NOT_FOUND',
              message: `Function ${input.function} does not exist`,
            }),
            (existing) =>
              TE.tryCatch(
                async () => {
                  // Remove trigger binding
                  const region = String((existing as Record<string, unknown>).region ?? '');
                  const triggerType = String((existing as Record<string, unknown>).triggerType ?? '');
                  await storage.delete('gcf-triggers', `${region}:${triggerType}`);
                  await storage.delete('gcf-functions', input.function);
                  return destroyOk(input.function);
                },
                toError,
              ),
          ),
        ),
      ),
    ),
};
