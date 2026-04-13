// @clef-handler style=functional
// @migrated dsl-constructs 2026-03-18
// PluginRegistry Concept Implementation
import type { FunctionalConceptHandler } from '../../../runtime/functional-handler.ts';
import {
  createProgram, get as spGet, find, put, del, branch, complete,
  type StorageProgram,
} from '../../../runtime/storage-program.ts';
import { autoInterpret } from '../../../runtime/functional-compat.ts';

const _pluginRegistryHandler: FunctionalConceptHandler = {
  register(input: Record<string, unknown>) {
    if (!input.type || (typeof input.type === 'string' && (input.type as string).trim() === '')) {
      return complete(createProgram(), 'error', { message: 'type is required' }) as StorageProgram<Result>;
    }
    const category = (input.category ?? input.type ?? '') as string;
    const providerId = (input.provider_id ?? input.name ?? '') as string;
    const handler = (input.handler ?? input.metadata ?? '') as string;

    const key = `${category}:${providerId}`;

    let p = createProgram();
    p = spGet(p, 'pluginregistry', key, 'existing');
    p = branch(p, 'existing',
      (b) => complete(b, 'exists', { plugin: key }),
      (b) => {
        let b2 = put(b, 'pluginregistry', key, {
          id: key,
          category,
          provider_id: providerId,
          handler,
          type: category,
          name: providerId,
          registeredAt: new Date().toISOString(),
        });
        return complete(b2, 'ok', { plugin: key });
      },
    );

    return p as StorageProgram<{ variant: string; [key: string]: unknown }>;
  },

  remove(input: Record<string, unknown>) {
    if (!input.type || (typeof input.type === 'string' && (input.type as string).trim() === '')) {
      return complete(createProgram(), 'error', { message: 'type is required' }) as StorageProgram<{ variant: string; [key: string]: unknown }>;
    }
    const category = (input.category ?? input.type ?? '') as string;
    const providerId = (input.provider_id ?? input.name ?? '') as string;

    if (!providerId || (typeof providerId === 'string' && providerId.trim() === '')) {
      return complete(createProgram(), 'error', { message: 'name is required' }) as StorageProgram<{ variant: string; [key: string]: unknown }>;
    }

    const key = `${category}:${providerId}`;

    let p = createProgram();
    p = spGet(p, 'pluginregistry', key, 'existing');
    p = branch(p, 'existing',
      (b) => {
        let b2 = del(b, 'pluginregistry', key);
        return complete(b2, 'ok', { plugin: key });
      },
      (b) => complete(b, 'not_found', { type: category, name: providerId }),
    );

    return p as StorageProgram<{ variant: string; [key: string]: unknown }>;
  },

  discover(input: Record<string, unknown>) {
    if (!input.type || (typeof input.type === 'string' && (input.type as string).trim() === '')) {
      return complete(createProgram(), 'error', { message: 'type is required' }) as StorageProgram<Result>;
    }
    const type = input.type as string;

    let p = createProgram();
    p = find(p, 'pluginregistry', { type }, 'allDefinitions');

    return complete(p, 'ok', { plugins: JSON.stringify([]) }) as StorageProgram<{ variant: string; [key: string]: unknown }>;
  },

  createInstance(input: Record<string, unknown>) {
    const plugin = input.plugin as string;
    const config = input.config as string;

    // Validate config JSON before any storage operations
    let parsedConfig: Record<string, unknown>;
    try {
      parsedConfig = JSON.parse(config) as Record<string, unknown>;
    } catch {
      return complete(createProgram(), 'error', { message: 'config must be valid JSON' }) as StorageProgram<{ variant: string; [key: string]: unknown }>;
    }

    let p = createProgram();
    p = spGet(p, 'pluginregistry', plugin, 'definition');

    const instanceId = `${plugin}:${Date.now()}`;

    const instance = {
      instanceId,
      plugin,
      type: 'unknown',
      config: parsedConfig,
      metadata: {},
      createdAt: Date.now(),
    };

    p = put(p, 'pluginInstance', instanceId, instance);

    return complete(p, 'ok', { instance: JSON.stringify(instance) }) as StorageProgram<{ variant: string; [key: string]: unknown }>;
  },

  getDefinitions(input: Record<string, unknown>) {
    if (!input.type || (typeof input.type === 'string' && (input.type as string).trim() === '')) {
      return complete(createProgram(), 'error', { message: 'type is required' }) as StorageProgram<Result>;
    }
    const type = input.type as string;

    let p = createProgram();
    p = find(p, 'pluginregistry', { type }, 'allDefinitions');

    return complete(p, 'ok', { definitions: JSON.stringify([]) }) as StorageProgram<{ variant: string; [key: string]: unknown }>;
  },

  alterDefinitions(input: Record<string, unknown>) {
    if (!input.type || (typeof input.type === 'string' && (input.type as string).trim() === '')) {
      return complete(createProgram(), 'error', { message: 'type is required' }) as StorageProgram<Result>;
    }
    const type = input.type as string;
    const alterations = input.alterations as string;

    let p = createProgram();
    p = find(p, 'pluginregistry', { type }, 'allDefinitions');

    return complete(p, 'ok', {}) as StorageProgram<{ variant: string; [key: string]: unknown }>;
  },

  derivePlugins(input: Record<string, unknown>) {
    const plugin = input.plugin as string;
    const config = input.config as string;

    let p = createProgram();
    p = spGet(p, 'pluginregistry', plugin, 'baseDefinition');
    p = branch(p, 'baseDefinition',
      (b) => {
        const parsedConfig = JSON.parse(config) as Record<string, unknown>;
        const derivedId = `${plugin}:derived:${Date.now()}`;

        const derived = {
          id: derivedId,
          type: 'unknown',
          metadata: {},
          config: parsedConfig,
          derivedFrom: plugin,
        };

        let b2 = put(b, 'pluginregistry', derivedId, derived);
        return complete(b2, 'ok', { derived: JSON.stringify(derived) });
      },
      (b) => complete(b, 'notfound', {}),
    );

    return p as StorageProgram<{ variant: string; [key: string]: unknown }>;
  },
};

export const pluginRegistryHandler = autoInterpret(_pluginRegistryHandler);

