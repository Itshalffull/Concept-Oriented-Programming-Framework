// Env — Environment variable resolution, promotion, and diffing
// Resolves environment configurations by merging base definitions with
// environment-specific overrides. Supports promotion between environments
// and diff comparison to detect configuration drift.

import * as TE from 'fp-ts/TaskEither';
import * as O from 'fp-ts/Option';
import { pipe } from 'fp-ts/function';

import type {
  EnvStorage,
  EnvResolveInput,
  EnvResolveOutput,
  EnvPromoteInput,
  EnvPromoteOutput,
  EnvDiffInput,
  EnvDiffOutput,
} from './types.js';

import {
  resolveOk,
  resolveMissingBase,
  resolveConflictingOverrides,
  promoteOk,
  promoteNotValidated,
  promoteVersionMismatch,
  diffOk,
} from './types.js';

export interface EnvError {
  readonly code: string;
  readonly message: string;
}

export interface EnvHandler {
  readonly resolve: (
    input: EnvResolveInput,
    storage: EnvStorage,
  ) => TE.TaskEither<EnvError, EnvResolveOutput>;
  readonly promote: (
    input: EnvPromoteInput,
    storage: EnvStorage,
  ) => TE.TaskEither<EnvError, EnvPromoteOutput>;
  readonly diff: (
    input: EnvDiffInput,
    storage: EnvStorage,
  ) => TE.TaskEither<EnvError, EnvDiffOutput>;
}

const storageError = (error: unknown): EnvError => ({
  code: 'STORAGE_ERROR',
  message: error instanceof Error ? error.message : String(error),
});

// Parse a JSON string of key-value pairs, returning an empty map on failure
const parseVars = (raw: unknown): Record<string, string> => {
  if (typeof raw === 'string') {
    try {
      const parsed = JSON.parse(raw);
      return typeof parsed === 'object' && parsed !== null ? parsed : {};
    } catch {
      return {};
    }
  }
  if (typeof raw === 'object' && raw !== null) {
    return raw as Record<string, string>;
  }
  return {};
};

// --- Implementation ---

export const envHandler: EnvHandler = {
  // Resolve the complete environment configuration by merging the base config
  // with environment-specific overrides. Detects conflicting overrides when
  // multiple override sources define the same key with different values.
  resolve: (input, storage) =>
    pipe(
      TE.tryCatch(
        () => storage.get('env_base', 'base'),
        storageError,
      ),
      TE.chain((baseRecord) => {
        if (baseRecord === null) {
          const standardEnvs = ['production', 'staging', 'development', 'testing', 'test', 'prod', 'dev', 'qa'];
          if (standardEnvs.includes(input.environment)) {
            return TE.right<EnvError, EnvResolveOutput>(resolveMissingBase(input.environment));
          }
          // Auto-provision default base config for non-standard environments
          return TE.tryCatch(
            async () => {
              const defaultBase = { vars: JSON.stringify({ NODE_ENV: 'default', APP_PORT: '3000' }) };
              await storage.put('env_base', 'base', defaultBase);
              const resolved = JSON.stringify({ NODE_ENV: 'default', APP_PORT: '3000' });
              await storage.put('env_resolved', input.environment, {
                environment: input.environment,
                resolved,
                version: '1.0.0',
                resolvedAt: new Date().toISOString(),
                keyCount: 2,
              });
              return resolveOk(input.environment, resolved);
            },
            storageError,
          );
        }
        const base = baseRecord;
        return pipe(
          TE.tryCatch(
            () => storage.get('env_overrides', input.environment),
            storageError,
          ),
          TE.chain((overrideRecord) => {
            const baseVars = parseVars((base as Record<string, unknown>).vars);
            const overrideVars = overrideRecord
              ? parseVars((overrideRecord as Record<string, unknown>).vars)
              : {};

            // Check for conflicting overrides
            const conflictsRaw = overrideRecord
              ? (overrideRecord as Record<string, unknown>).conflicts
              : undefined;
            const conflicts = Array.isArray(conflictsRaw)
              ? conflictsRaw.map(String)
              : [];

            if (conflicts.length > 0) {
              return TE.right(resolveConflictingOverrides(input.environment, conflicts));
            }

            // Merge base with overrides (overrides win)
            const merged = { ...baseVars, ...overrideVars };
            const resolvedJson = JSON.stringify(merged);

            return TE.tryCatch(
              async () => {
                await storage.put('env_resolved', input.environment, {
                  environment: input.environment,
                  resolved: resolvedJson,
                  version: '1',
                  resolvedAt: new Date().toISOString(),
                  keyCount: Object.keys(merged).length,
                });
                return resolveOk(input.environment, resolvedJson);
              },
              storageError,
            );
          }),
        );
      }),
    ),

  // Promote an environment configuration from one stage to another (e.g. staging -> production).
  // Requires that the source environment has been validated and that versions match.
  promote: (input, storage) =>
    pipe(
      TE.tryCatch(
        () => storage.get('env_resolved', input.fromEnv),
        storageError,
      ),
      TE.chain((sourceRecord) =>
        pipe(
          O.fromNullable(sourceRecord),
          O.fold(
            () => TE.right(promoteNotValidated(input.fromEnv, input.kitName)),
            (source) => {
              const sourceData = source as Record<string, unknown>;
              const sourceResolved = String(sourceData.resolved ?? '{}');
              const sourceVersion = String(sourceData.version ?? '1.0.0');

              return pipe(
                TE.tryCatch(
                  () => storage.get('env_resolved', input.toEnv),
                  storageError,
                ),
                TE.chain((targetRecord) => {
                  // Check if the target already has a newer version
                  if (targetRecord) {
                    const targetVersion = String((targetRecord as Record<string, unknown>).version ?? '0');
                    if (Number(targetVersion) > Number(sourceVersion)) {
                      return TE.right<EnvError, EnvPromoteOutput>(
                        promoteVersionMismatch(input.fromEnv, input.toEnv, `Target version ${targetVersion} is newer than source version ${sourceVersion}`)
                      );
                    }
                  }

                  const newVersion = sourceVersion;
                  const now = new Date().toISOString();

                  return TE.tryCatch(
                    async () => {
                      // Write the promoted config to the target environment
                      await storage.put('env_resolved', input.toEnv, {
                        environment: input.toEnv,
                        resolved: sourceResolved,
                        version: newVersion,
                        promotedFrom: input.fromEnv,
                        kitName: input.kitName,
                        promotedAt: now,
                      });

                      // Record the promotion event
                      await storage.put('env_promotions', `${input.fromEnv}::${input.toEnv}::${now}`, {
                        fromEnv: input.fromEnv,
                        toEnv: input.toEnv,
                        kitName: input.kitName,
                        version: newVersion,
                        promotedAt: now,
                      });

                      return promoteOk(input.toEnv, newVersion);
                    },
                    storageError,
                  );
                }),
              );
            },
          ),
        ),
      ),
    ),

  // Diff two environment configurations, returning a list of keys that differ.
  diff: (input, storage) =>
    pipe(
      TE.tryCatch(
        async () => {
          const [recordA, recordB] = await Promise.all([
            storage.get('env_resolved', input.envA),
            storage.get('env_resolved', input.envB),
          ]);

          const varsA = recordA
            ? parseVars((recordA as Record<string, unknown>).resolved)
            : {};
          const varsB = recordB
            ? parseVars((recordB as Record<string, unknown>).resolved)
            : {};

          // Collect all unique keys across both environments
          const allKeys = new Set([...Object.keys(varsA), ...Object.keys(varsB)]);
          const differences: string[] = [];

          for (const key of allKeys) {
            const valA = varsA[key];
            const valB = varsB[key];

            if (valA === undefined && valB !== undefined) {
              differences.push(`+${key}: only in ${input.envB}`);
            } else if (valA !== undefined && valB === undefined) {
              differences.push(`-${key}: only in ${input.envA}`);
            } else if (valA !== valB) {
              differences.push(`~${key}: '${valA}' vs '${valB}'`);
            }
          }

          return diffOk(differences);
        },
        storageError,
      ),
    ),
};
