// ConfigSync — handler.ts
// Real fp-ts domain logic for configuration management with versioning, overrides, and diff.

import * as TE from 'fp-ts/TaskEither';
import * as O from 'fp-ts/Option';
import { pipe } from 'fp-ts/function';

import type {
  ConfigSyncStorage,
  ConfigSyncExportInput,
  ConfigSyncExportOutput,
  ConfigSyncImportInput,
  ConfigSyncImportOutput,
  ConfigSyncOverrideInput,
  ConfigSyncOverrideOutput,
  ConfigSyncDiffInput,
  ConfigSyncDiffOutput,
} from './types.js';

import {
  exportOk,
  exportNotfound,
  importOk,
  importError,
  overrideOk,
  overrideNotfound,
  diffOk,
  diffNotfound,
} from './types.js';

export interface ConfigSyncError {
  readonly code: string;
  readonly message: string;
}

export interface ConfigSyncHandler {
  readonly export: (
    input: ConfigSyncExportInput,
    storage: ConfigSyncStorage,
  ) => TE.TaskEither<ConfigSyncError, ConfigSyncExportOutput>;
  readonly import: (
    input: ConfigSyncImportInput,
    storage: ConfigSyncStorage,
  ) => TE.TaskEither<ConfigSyncError, ConfigSyncImportOutput>;
  readonly override: (
    input: ConfigSyncOverrideInput,
    storage: ConfigSyncStorage,
  ) => TE.TaskEither<ConfigSyncError, ConfigSyncOverrideOutput>;
  readonly diff: (
    input: ConfigSyncDiffInput,
    storage: ConfigSyncStorage,
  ) => TE.TaskEither<ConfigSyncError, ConfigSyncDiffOutput>;
}

// --- Pure helpers ---

const storageError = (error: unknown): ConfigSyncError => ({
  code: 'STORAGE_ERROR',
  message: error instanceof Error ? error.message : String(error),
});

/** Safely parse JSON, returning null on failure. */
const safeParseJson = (raw: string): Record<string, unknown> | null => {
  try {
    return JSON.parse(raw) as Record<string, unknown>;
  } catch {
    return null;
  }
};

/**
 * Apply environment-specific overrides to a base config. Overrides are
 * parsed as "key=value" pairs separated by commas or newlines. Each
 * key-value pair is merged onto the base config data.
 */
const applyOverrides = (
  baseData: Record<string, unknown>,
  valuesStr: string,
): Record<string, unknown> => {
  // First try parsing as JSON
  const asJson = safeParseJson(valuesStr);
  if (asJson) {
    return { ...baseData, ...asJson };
  }
  // Otherwise parse as "key=value" pairs separated by commas or semicolons
  const result = { ...baseData };
  const pairs = valuesStr.split(/[,;\n]/).map((p) => p.trim()).filter((p) => p.length > 0);
  for (const pair of pairs) {
    const eqIdx = pair.indexOf('=');
    if (eqIdx > 0) {
      const key = pair.slice(0, eqIdx).trim();
      const value = pair.slice(eqIdx + 1).trim();
      result[key] = value;
    }
  }
  return result;
};

/**
 * Compute a structured diff between two configuration data objects.
 * Returns an array of change descriptors: { key, type, from?, to? }.
 */
const computeDiff = (
  dataA: Record<string, unknown>,
  dataB: Record<string, unknown>,
): readonly { readonly key: string; readonly type: string; readonly from?: unknown; readonly to?: unknown }[] => {
  const allKeys = new Set([...Object.keys(dataA), ...Object.keys(dataB)]);
  const changes: { readonly key: string; readonly type: string; readonly from?: unknown; readonly to?: unknown }[] = [];

  for (const key of allKeys) {
    const inA = key in dataA;
    const inB = key in dataB;

    if (inA && !inB) {
      changes.push({ key, type: 'removed', from: dataA[key] });
    } else if (!inA && inB) {
      changes.push({ key, type: 'added', to: dataB[key] });
    } else if (inA && inB) {
      const valA = JSON.stringify(dataA[key]);
      const valB = JSON.stringify(dataB[key]);
      if (valA !== valB) {
        changes.push({ key, type: 'changed', from: dataA[key], to: dataB[key] });
      }
    }
  }

  return changes;
};

// --- Implementation ---

export const configSyncHandler: ConfigSyncHandler = {
  /**
   * Export a configuration as serialized JSON data. The exported data
   * includes the base config merged with all override layers, plus
   * a version counter for change tracking.
   */
  export: (input, storage) =>
    pipe(
      TE.tryCatch(
        () => storage.get('configs', input.config),
        storageError,
      ),
      TE.chain((record) =>
        pipe(
          O.fromNullable(record),
          O.fold(
            () => TE.right<ConfigSyncError, ConfigSyncExportOutput>(exportNotfound()),
            (config) =>
              pipe(
                TE.tryCatch(
                  () => storage.find('overrides', { config: input.config }),
                  storageError,
                ),
                TE.map((overrideRecords) => {
                  // Start with base data
                  let baseData = safeParseJson((config.data as string) ?? '{}') ?? {};
                  // Layer overrides in order of application
                  const sortedOverrides = [...overrideRecords].sort((a, b) => {
                    const ta = typeof a.appliedAt === 'number' ? a.appliedAt : 0;
                    const tb = typeof b.appliedAt === 'number' ? b.appliedAt : 0;
                    return ta - tb;
                  });
                  for (const ovr of sortedOverrides) {
                    const overrideData = safeParseJson((ovr.values as string) ?? '{}') ?? {};
                    baseData = { ...baseData, ...overrideData };
                  }
                  const exportData = {
                    config: input.config,
                    version: config.version ?? 1,
                    data: baseData,
                    exportedAt: Date.now(),
                  };
                  return exportOk(JSON.stringify(exportData));
                }),
              ),
          ),
        ),
      ),
    ),

  /**
   * Import serialized configuration data. Validates the JSON structure
   * and stores it as the new base configuration with an incremented version.
   */
  import: (input, storage) => {
    const parsed = safeParseJson(input.data);
    if (!parsed) {
      return TE.right<ConfigSyncError, ConfigSyncImportOutput>(
        importError('Invalid JSON: configuration data could not be parsed'),
      );
    }
    return pipe(
      TE.tryCatch(
        () => storage.get('configs', input.config),
        storageError,
      ),
      TE.chain((existing) => {
        const currentVersion = pipe(
          O.fromNullable(existing),
          O.fold(
            () => 0,
            (rec) => (typeof rec.version === 'number' ? rec.version : 0),
          ),
        );
        return TE.tryCatch(
          async () => {
            const newVersion = currentVersion + 1;
            // Store the previous version for rollback capability
            if (existing) {
              await storage.put('configHistory', `${input.config}::v${currentVersion}`, {
                ...existing,
                archivedAt: Date.now(),
              });
            }
            // Store the imported data
            const importedData = parsed.data ?? parsed;
            await storage.put('configs', input.config, {
              config: input.config,
              data: JSON.stringify(importedData),
              version: newVersion,
              importedAt: Date.now(),
            });
            return importOk();
          },
          storageError,
        );
      }),
    );
  },

  /**
   * Apply environment-specific overrides (e.g., "production", "staging")
   * to a configuration at a named layer. The configuration must exist.
   */
  override: (input, storage) =>
    pipe(
      TE.tryCatch(
        () => storage.get('configs', input.config),
        storageError,
      ),
      TE.chain((record) =>
        pipe(
          O.fromNullable(record),
          O.fold(
            () => TE.right<ConfigSyncError, ConfigSyncOverrideOutput>(overrideNotfound()),
            (config) => {
              // Parse override values
              const overrideData = applyOverrides({}, input.values);
              const overrideKey = `${input.config}::${input.layer}`;
              return TE.tryCatch(
                async () => {
                  await storage.put('overrides', overrideKey, {
                    config: input.config,
                    layer: input.layer,
                    values: JSON.stringify(overrideData),
                    appliedAt: Date.now(),
                  });
                  // Increment version on the base config to signal a change
                  const currentVersion = typeof config.version === 'number' ? config.version : 0;
                  await storage.put('configs', input.config, {
                    ...config,
                    version: currentVersion + 1,
                    lastOverrideAt: Date.now(),
                  });
                  return overrideOk();
                },
                storageError,
              );
            },
          ),
        ),
      ),
    ),

  /**
   * Compute a structured diff between two configurations. Both configs
   * must exist. The diff includes added, removed, and changed keys.
   */
  diff: (input, storage) =>
    pipe(
      TE.tryCatch(
        async () => {
          const configA = await storage.get('configs', input.configA);
          const configB = await storage.get('configs', input.configB);
          return { configA, configB };
        },
        storageError,
      ),
      TE.chain(({ configA, configB }) => {
        if (!configA || !configB) {
          return TE.right<ConfigSyncError, ConfigSyncDiffOutput>(diffNotfound());
        }
        const dataA = safeParseJson((configA.data as string) ?? '{}') ?? {};
        const dataB = safeParseJson((configB.data as string) ?? '{}') ?? {};
        const changes = computeDiff(dataA, dataB);
        return TE.right<ConfigSyncError, ConfigSyncDiffOutput>(
          diffOk(JSON.stringify(changes)),
        );
      }),
    ),
};
