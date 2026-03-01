// PluginRegistry — handler.ts
// Real fp-ts domain logic for plugin registration, discovery, and derivative creation.

import * as TE from 'fp-ts/TaskEither';
import * as O from 'fp-ts/Option';
import { pipe } from 'fp-ts/function';
import { randomBytes } from 'crypto';

import type {
  PluginRegistryStorage,
  PluginRegistryRegisterInput,
  PluginRegistryRegisterOutput,
  PluginRegistryDiscoverInput,
  PluginRegistryDiscoverOutput,
  PluginRegistryCreateInstanceInput,
  PluginRegistryCreateInstanceOutput,
  PluginRegistryGetDefinitionsInput,
  PluginRegistryGetDefinitionsOutput,
  PluginRegistryAlterDefinitionsInput,
  PluginRegistryAlterDefinitionsOutput,
  PluginRegistryDerivePluginsInput,
  PluginRegistryDerivePluginsOutput,
} from './types.js';

import {
  registerOk,
  registerExists,
  discoverOk,
  createInstanceOk,
  createInstanceNotfound,
  getDefinitionsOk,
  alterDefinitionsOk,
  derivePluginsOk,
  derivePluginsNotfound,
} from './types.js';

export interface PluginRegistryError {
  readonly code: string;
  readonly message: string;
}

export interface PluginRegistryHandler {
  readonly register: (
    input: PluginRegistryRegisterInput,
    storage: PluginRegistryStorage,
  ) => TE.TaskEither<PluginRegistryError, PluginRegistryRegisterOutput>;
  readonly discover: (
    input: PluginRegistryDiscoverInput,
    storage: PluginRegistryStorage,
  ) => TE.TaskEither<PluginRegistryError, PluginRegistryDiscoverOutput>;
  readonly createInstance: (
    input: PluginRegistryCreateInstanceInput,
    storage: PluginRegistryStorage,
  ) => TE.TaskEither<PluginRegistryError, PluginRegistryCreateInstanceOutput>;
  readonly getDefinitions: (
    input: PluginRegistryGetDefinitionsInput,
    storage: PluginRegistryStorage,
  ) => TE.TaskEither<PluginRegistryError, PluginRegistryGetDefinitionsOutput>;
  readonly alterDefinitions: (
    input: PluginRegistryAlterDefinitionsInput,
    storage: PluginRegistryStorage,
  ) => TE.TaskEither<PluginRegistryError, PluginRegistryAlterDefinitionsOutput>;
  readonly derivePlugins: (
    input: PluginRegistryDerivePluginsInput,
    storage: PluginRegistryStorage,
  ) => TE.TaskEither<PluginRegistryError, PluginRegistryDerivePluginsOutput>;
}

// --- Pure helpers ---

const generateId = (): string => randomBytes(12).toString('hex');

/** Composite key for plugin definitions: type::name. */
const pluginKey = (type: string, name: string): string => `${type}::${name}`;

const storageError = (error: unknown): PluginRegistryError => ({
  code: 'STORAGE_ERROR',
  message: error instanceof Error ? error.message : String(error),
});

/** Safely parse a JSON string, returning an empty object on failure. */
const safeParseJson = (raw: string): Record<string, unknown> => {
  try {
    return JSON.parse(raw) as Record<string, unknown>;
  } catch {
    return {};
  }
};

/** Merge two JSON-encoded metadata objects (deep-shallow). */
const mergeMetadata = (
  base: Record<string, unknown>,
  overrides: Record<string, unknown>,
): Record<string, unknown> => ({ ...base, ...overrides });

// --- Implementation ---

export const pluginRegistryHandler: PluginRegistryHandler = {
  /**
   * Register a plugin definition with type, name, and metadata. If a plugin
   * with the same type+name already exists, return the existing reference
   * (idempotent).
   */
  register: (input, storage) =>
    pipe(
      TE.tryCatch(
        () => storage.get('definitions', pluginKey(input.type, input.name)),
        storageError,
      ),
      TE.chain((existing) =>
        pipe(
          O.fromNullable(existing),
          O.fold(
            () => {
              const pluginId = `plugin_${generateId()}`;
              const metadata = safeParseJson(input.metadata);
              return TE.tryCatch(
                async () => {
                  // Ensure the plugin type is registered
                  const typeRecord = await storage.get('pluginTypes', input.type);
                  if (!typeRecord) {
                    await storage.put('pluginTypes', input.type, {
                      type: input.type,
                      registeredAt: Date.now(),
                    });
                  }
                  await storage.put('definitions', pluginKey(input.type, input.name), {
                    pluginId,
                    type: input.type,
                    name: input.name,
                    metadata: JSON.stringify(metadata),
                    enabled: true,
                    registeredAt: Date.now(),
                  });
                  return registerOk(pluginId);
                },
                storageError,
              );
            },
            (record) =>
              TE.right<PluginRegistryError, PluginRegistryRegisterOutput>(
                registerExists(record.pluginId as string),
              ),
          ),
        ),
      ),
    ),

  /**
   * Discover all enabled plugins of a given type by scanning definitions.
   */
  discover: (input, storage) =>
    pipe(
      TE.tryCatch(
        () => storage.find('definitions', { type: input.type }),
        storageError,
      ),
      TE.map((records) => {
        const enabled = records.filter((r) => r.enabled !== false);
        const plugins = enabled.map((r) => ({
          pluginId: r.pluginId,
          name: r.name,
          type: r.type,
          metadata: r.metadata,
        }));
        return discoverOk(JSON.stringify(plugins));
      }),
    ),

  /**
   * Create a configured instance of a plugin definition. The plugin must
   * exist in the registry. The config is merged with the plugin's base metadata.
   */
  createInstance: (input, storage) =>
    pipe(
      TE.tryCatch(
        () => storage.get('definitions', input.plugin),
        storageError,
      ),
      TE.chain((record) => {
        // Also try finding by pluginId across all definitions
        if (record) {
          return TE.right<PluginRegistryError, Record<string, unknown> | null>(record);
        }
        return TE.tryCatch(
          async () => {
            const allDefs = await storage.find('definitions');
            const match = allDefs.find((d) => d.pluginId === input.plugin);
            return match ?? null;
          },
          storageError,
        );
      }),
      TE.chain((record) =>
        pipe(
          O.fromNullable(record as Record<string, unknown> | null),
          O.fold(
            () => TE.right<PluginRegistryError, PluginRegistryCreateInstanceOutput>(
              createInstanceNotfound(),
            ),
            (pluginDef) => {
              const baseMetadata = safeParseJson((pluginDef.metadata as string) ?? '{}');
              const instanceConfig = safeParseJson(input.config);
              const mergedConfig = mergeMetadata(baseMetadata, instanceConfig);
              const instanceId = `inst_${generateId()}`;
              return TE.tryCatch(
                async () => {
                  await storage.put('instances', instanceId, {
                    instanceId,
                    pluginId: pluginDef.pluginId,
                    type: pluginDef.type,
                    name: pluginDef.name,
                    config: JSON.stringify(mergedConfig),
                    createdAt: Date.now(),
                  });
                  return createInstanceOk(instanceId);
                },
                storageError,
              );
            },
          ),
        ),
      ),
    ),

  /**
   * Return all registered plugin definitions for the specified type as a
   * JSON-encoded array.
   */
  getDefinitions: (input, storage) =>
    pipe(
      TE.tryCatch(
        () => storage.find('definitions', { type: input.type }),
        storageError,
      ),
      TE.map((records) => {
        const definitions = records.map((r) => ({
          pluginId: r.pluginId,
          name: r.name,
          type: r.type,
          metadata: r.metadata,
          enabled: r.enabled,
        }));
        return getDefinitionsOk(JSON.stringify(definitions));
      }),
    ),

  /**
   * Apply alterations (a JSON-encoded set of changes) to all plugin
   * definitions of the specified type.
   */
  alterDefinitions: (input, storage) =>
    pipe(
      TE.tryCatch(
        () => storage.find('definitions', { type: input.type }),
        storageError,
      ),
      TE.chain((records) => {
        const alterations = safeParseJson(input.alterations);
        return TE.tryCatch(
          async () => {
            for (const rec of records) {
              const key = pluginKey(rec.type as string, rec.name as string);
              const currentMeta = safeParseJson((rec.metadata as string) ?? '{}');
              const alteredMeta = mergeMetadata(currentMeta, alterations);
              await storage.put('definitions', key, {
                ...rec,
                metadata: JSON.stringify(alteredMeta),
                alteredAt: Date.now(),
              });
            }
            return alterDefinitionsOk();
          },
          storageError,
        );
      }),
    ),

  /**
   * Create derivative plugin definitions from an existing plugin, applying
   * config overrides to produce a new plugin definition.
   */
  derivePlugins: (input, storage) =>
    pipe(
      TE.tryCatch(
        async () => {
          // Look up base plugin by direct key or by pluginId
          let record = await storage.get('definitions', input.plugin);
          if (!record) {
            const allDefs = await storage.find('definitions');
            record = (allDefs.find((d) => d.pluginId === input.plugin) as Record<string, unknown>) ?? null;
          }
          return record;
        },
        storageError,
      ),
      TE.chain((record) =>
        pipe(
          O.fromNullable(record),
          O.fold(
            () => TE.right<PluginRegistryError, PluginRegistryDerivePluginsOutput>(
              derivePluginsNotfound(),
            ),
            (baseDef) => {
              const baseMetadata = safeParseJson((baseDef.metadata as string) ?? '{}');
              const derivedConfig = safeParseJson(input.config);
              const derivedMeta = mergeMetadata(baseMetadata, derivedConfig);
              const derivedId = `derived_${generateId()}`;
              const derivedName = `${baseDef.name as string}_derived_${derivedId.slice(-6)}`;
              return TE.tryCatch(
                async () => {
                  await storage.put(
                    'definitions',
                    pluginKey(baseDef.type as string, derivedName),
                    {
                      pluginId: derivedId,
                      type: baseDef.type,
                      name: derivedName,
                      metadata: JSON.stringify(derivedMeta),
                      derivedFrom: baseDef.pluginId,
                      enabled: true,
                      registeredAt: Date.now(),
                    },
                  );
                  return derivePluginsOk(derivedId);
                },
                storageError,
              );
            },
          ),
        ),
      ),
    ),
};
