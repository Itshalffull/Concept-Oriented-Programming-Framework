// LambdaRuntime — AWS Lambda runtime adapter for packaging handlers,
// configuring triggers, managing cold starts, and tracking invocations.

import * as TE from 'fp-ts/TaskEither';
import * as O from 'fp-ts/Option';
import { pipe } from 'fp-ts/function';

import type {
  LambdaRuntimeStorage,
  LambdaRuntimeProvisionInput,
  LambdaRuntimeProvisionOutput,
  LambdaRuntimeDeployInput,
  LambdaRuntimeDeployOutput,
  LambdaRuntimeSetTrafficWeightInput,
  LambdaRuntimeSetTrafficWeightOutput,
  LambdaRuntimeRollbackInput,
  LambdaRuntimeRollbackOutput,
  LambdaRuntimeDestroyInput,
  LambdaRuntimeDestroyOutput,
} from './types.js';

import {
  provisionOk,
  provisionQuotaExceeded,
  provisionIamError,
  deployOk,
  deployPackageTooLarge,
  deployRuntimeUnsupported,
  setTrafficWeightOk,
  rollbackOk,
  destroyOk,
  destroyResourceInUse,
} from './types.js';

export interface LambdaRuntimeError {
  readonly code: string;
  readonly message: string;
}

const toError = (error: unknown): LambdaRuntimeError => ({
  code: 'STORAGE_ERROR',
  message: error instanceof Error ? error.message : String(error),
});

// Lambda service limits
const MAX_FUNCTIONS_PER_REGION = 1000;
const MAX_PACKAGE_BYTES = 250 * 1024 * 1024; // 250 MB unzipped
const SUPPORTED_RUNTIMES: readonly string[] = [
  'nodejs18.x', 'nodejs20.x', 'nodejs22.x',
  'python3.9', 'python3.10', 'python3.11', 'python3.12',
  'java17', 'java21',
  'provided.al2', 'provided.al2023',
];

export interface LambdaRuntimeHandler {
  readonly provision: (
    input: LambdaRuntimeProvisionInput,
    storage: LambdaRuntimeStorage,
  ) => TE.TaskEither<LambdaRuntimeError, LambdaRuntimeProvisionOutput>;
  readonly deploy: (
    input: LambdaRuntimeDeployInput,
    storage: LambdaRuntimeStorage,
  ) => TE.TaskEither<LambdaRuntimeError, LambdaRuntimeDeployOutput>;
  readonly setTrafficWeight: (
    input: LambdaRuntimeSetTrafficWeightInput,
    storage: LambdaRuntimeStorage,
  ) => TE.TaskEither<LambdaRuntimeError, LambdaRuntimeSetTrafficWeightOutput>;
  readonly rollback: (
    input: LambdaRuntimeRollbackInput,
    storage: LambdaRuntimeStorage,
  ) => TE.TaskEither<LambdaRuntimeError, LambdaRuntimeRollbackOutput>;
  readonly destroy: (
    input: LambdaRuntimeDestroyInput,
    storage: LambdaRuntimeStorage,
  ) => TE.TaskEither<LambdaRuntimeError, LambdaRuntimeDestroyOutput>;
}

// --- Implementation ---

export const lambdaRuntimeHandler: LambdaRuntimeHandler = {
  // Provision a new Lambda function: validate IAM execution role availability,
  // check regional function quota, generate ARN and invoke URL.
  provision: (input, storage) =>
    pipe(
      TE.tryCatch(
        () => storage.get('iam_roles', `lambda-exec-${input.concept}`),
        toError,
      ),
      TE.chain((iamRecord) =>
        pipe(
          O.fromNullable(iamRecord),
          O.fold(
            () =>
              TE.right(
                provisionIamError(
                  `lambda-exec-${input.concept}`,
                  `No execution role found for concept ${input.concept}`,
                ) as LambdaRuntimeProvisionOutput,
              ),
            () =>
              pipe(
                TE.tryCatch(
                  () => storage.find('functions', { region: input.region }),
                  toError,
                ),
                TE.chain((regionFunctions) => {
                  if (regionFunctions.length >= MAX_FUNCTIONS_PER_REGION) {
                    return TE.right(
                      provisionQuotaExceeded(
                        input.region,
                        `Maximum ${MAX_FUNCTIONS_PER_REGION} functions per region`,
                      ) as LambdaRuntimeProvisionOutput,
                    );
                  }
                  const functionName = `clef-${input.concept}`;
                  const functionArn = `arn:aws:lambda:${input.region}:000000000000:function:${functionName}`;
                  const endpoint = `https://${functionName}.lambda-url.${input.region}.on.aws`;
                  return pipe(
                    TE.tryCatch(
                      async () => {
                        await storage.put('functions', functionName, {
                          concept: input.concept,
                          functionName,
                          functionArn,
                          endpoint,
                          memory: input.memory,
                          timeout: input.timeout,
                          region: input.region,
                          status: 'provisioned',
                          versions: [],
                          aliasWeight: 100,
                          createdAt: Date.now(),
                        });
                      },
                      toError,
                    ),
                    TE.map(() => provisionOk(functionName, functionArn, endpoint) as LambdaRuntimeProvisionOutput),
                  );
                }),
              ),
          ),
        ),
      ),
    ),

  // Deploy a new version to a Lambda function: validate package size, record
  // the new version, and update the function configuration.
  deploy: (input, storage) =>
    pipe(
      TE.tryCatch(
        () => storage.get('functions', input.function),
        toError,
      ),
      TE.chain((record) =>
        pipe(
          O.fromNullable(record),
          O.fold(
            () => TE.left<LambdaRuntimeError>({ code: 'NOT_FOUND', message: `Function ${input.function} not found` }),
            (existing) => {
              // Check artifact metadata for package size
              const artifactSize = typeof existing.lastArtifactSize === 'number'
                ? existing.lastArtifactSize
                : 0;
              if (artifactSize > MAX_PACKAGE_BYTES) {
                return TE.right(
                  deployPackageTooLarge(input.function, artifactSize, MAX_PACKAGE_BYTES) as LambdaRuntimeDeployOutput,
                );
              }
              // Check runtime compatibility from function config
              const runtime = typeof existing.runtime === 'string' ? existing.runtime : '';
              if (runtime && !SUPPORTED_RUNTIMES.includes(runtime)) {
                return TE.right(
                  deployRuntimeUnsupported(input.function, runtime) as LambdaRuntimeDeployOutput,
                );
              }
              const previousVersions = Array.isArray(existing.versions) ? existing.versions : [];
              const versionNumber = previousVersions.length + 1;
              const version = `v${versionNumber}`;
              return pipe(
                TE.tryCatch(
                  async () => {
                    await storage.put('functions', input.function, {
                      ...existing,
                      artifactLocation: input.artifactLocation,
                      currentVersion: version,
                      versions: [...previousVersions, { version, artifactLocation: input.artifactLocation, deployedAt: Date.now() }],
                      status: 'deployed',
                    });
                  },
                  toError,
                ),
                TE.map(() => deployOk(input.function, version) as LambdaRuntimeDeployOutput),
              );
            },
          ),
        ),
      ),
    ),

  // Set the alias traffic weight for gradual rollout. The aliasWeight (0-100)
  // controls what percentage of invocations route to the latest version.
  setTrafficWeight: (input, storage) =>
    pipe(
      TE.tryCatch(
        () => storage.get('functions', input.function),
        toError,
      ),
      TE.chain((record) =>
        pipe(
          O.fromNullable(record),
          O.fold(
            () => TE.left<LambdaRuntimeError>({ code: 'NOT_FOUND', message: `Function ${input.function} not found` }),
            (existing) => {
              const clampedWeight = Math.max(0, Math.min(100, input.aliasWeight));
              return pipe(
                TE.tryCatch(
                  async () => {
                    await storage.put('functions', input.function, {
                      ...existing,
                      aliasWeight: clampedWeight,
                    });
                  },
                  toError,
                ),
                TE.map(() => setTrafficWeightOk(input.function)),
              );
            },
          ),
        ),
      ),
    ),

  // Roll back a function to a previous published version by looking up the
  // version in the deployment history and restoring that artifact configuration.
  rollback: (input, storage) =>
    pipe(
      TE.tryCatch(
        () => storage.get('functions', input.function),
        toError,
      ),
      TE.chain((record) =>
        pipe(
          O.fromNullable(record),
          O.fold(
            () => TE.left<LambdaRuntimeError>({ code: 'NOT_FOUND', message: `Function ${input.function} not found` }),
            (existing) => {
              const versions = Array.isArray(existing.versions) ? existing.versions : [];
              const targetVer = versions.find(
                (v: Record<string, unknown>) => v.version === input.targetVersion,
              );
              if (!targetVer) {
                return TE.left<LambdaRuntimeError>({
                  code: 'VERSION_NOT_FOUND',
                  message: `Version ${input.targetVersion} not found for function ${input.function}`,
                });
              }
              return pipe(
                TE.tryCatch(
                  async () => {
                    await storage.put('functions', input.function, {
                      ...existing,
                      currentVersion: input.targetVersion,
                      artifactLocation: targetVer.artifactLocation,
                      status: 'rolled-back',
                    });
                  },
                  toError,
                ),
                TE.map(() => rollbackOk(input.function, input.targetVersion)),
              );
            },
          ),
        ),
      ),
    ),

  // Destroy a Lambda function: check for dependent event source mappings or
  // triggers before removing the function record.
  destroy: (input, storage) =>
    pipe(
      TE.tryCatch(
        () => storage.find('event_sources', { functionName: input.function }),
        toError,
      ),
      TE.chain((dependents) => {
        if (dependents.length > 0) {
          const dependentNames = dependents.map(
            (d) => (typeof d.name === 'string' ? d.name : 'unknown'),
          );
          return TE.right(destroyResourceInUse(input.function, dependentNames) as LambdaRuntimeDestroyOutput);
        }
        return pipe(
          TE.tryCatch(
            async () => {
              await storage.delete('functions', input.function);
            },
            toError,
          ),
          TE.map(() => destroyOk(input.function) as LambdaRuntimeDestroyOutput),
        );
      }),
    ),
};
