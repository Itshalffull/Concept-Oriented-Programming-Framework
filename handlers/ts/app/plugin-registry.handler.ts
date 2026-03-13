// PluginRegistry Concept Implementation
import type { ConceptHandler } from '@clef/runtime';

export const pluginRegistryHandler: ConceptHandler = {
  async register(input, storage) {
    // Support both legacy (type/name/metadata) and sync-native (category/provider_id/handler) fields
    const category = (input.category ?? input.type ?? '') as string;
    const providerId = (input.provider_id ?? input.name ?? '') as string;
    const handler = (input.handler ?? input.metadata ?? '') as string;

    const key = `${category}:${providerId}`;

    // Check if plugin already registered (idempotent)
    const existing = await storage.get('pluginregistry', key);
    if (existing && existing.category === category && existing.provider_id === providerId) {
      return { variant: 'exists', plugin: key };
    }

    await storage.put('pluginregistry', key, {
      id: key,
      category,
      provider_id: providerId,
      handler,
      // Legacy field aliases
      type: category,
      name: providerId,
      registeredAt: new Date().toISOString(),
    });

    return { variant: 'ok', plugin: key };
  },

  async discover(input, storage) {
    const type = input.type as string;

    const allDefinitions = await storage.find('pluginregistry', { type });
    const plugins = allDefinitions.map(def => ({
      id: def.id,
      type: def.type,
      metadata: def.metadata,
    }));

    return { variant: 'ok', plugins: JSON.stringify(plugins) };
  },

  async createInstance(input, storage) {
    const plugin = input.plugin as string;
    const config = input.config as string;

    let definition = await storage.get('pluginregistry', plugin);
    if (!definition) {
      // Auto-create a minimal plugin definition
      definition = {
        id: plugin,
        type: 'unknown',
        name: plugin,
        metadata: {},
        registeredAt: new Date().toISOString(),
      };
      await storage.put('pluginregistry', plugin, definition);
    }

    const instanceId = `${plugin}:${Date.now()}`;
    const parsedConfig = JSON.parse(config) as Record<string, unknown>;

    const instance = {
      instanceId,
      plugin,
      type: definition.type,
      config: parsedConfig,
      metadata: definition.metadata,
      createdAt: Date.now(),
    };

    await storage.put('pluginInstance', instanceId, instance);

    return { variant: 'ok', instance: JSON.stringify(instance) };
  },

  async getDefinitions(input, storage) {
    const type = input.type as string;

    const allDefinitions = await storage.find('pluginregistry', { type });
    const definitions = allDefinitions.map(def => ({
      id: def.id,
      type: def.type,
      metadata: def.metadata,
      config: def.config,
    }));

    return { variant: 'ok', definitions: JSON.stringify(definitions) };
  },

  async alterDefinitions(input, storage) {
    const type = input.type as string;
    const alterations = input.alterations as string;

    const parsedAlterations = JSON.parse(alterations) as Record<string, unknown>;
    const allDefinitions = await storage.find('pluginregistry', { type });

    for (const def of allDefinitions) {
      const id = def.id as string;
      const updated = { ...def, ...parsedAlterations };
      await storage.put('pluginregistry', id, updated);
    }

    return { variant: 'ok' };
  },

  async derivePlugins(input, storage) {
    const plugin = input.plugin as string;
    const config = input.config as string;

    const baseDefinition = await storage.get('pluginregistry', plugin);
    if (!baseDefinition) {
      return { variant: 'notfound' };
    }

    const parsedConfig = JSON.parse(config) as Record<string, unknown>;
    const derivedId = `${plugin}:derived:${Date.now()}`;

    const baseConfig = (baseDefinition.config ?? {}) as Record<string, unknown>;
    const mergedConfig = { ...baseConfig, ...parsedConfig };

    const derived = {
      id: derivedId,
      type: baseDefinition.type,
      metadata: baseDefinition.metadata,
      config: mergedConfig,
      derivedFrom: plugin,
    };

    await storage.put('pluginregistry', derivedId, derived);

    return { variant: 'ok', derived: JSON.stringify(derived) };
  },
};
