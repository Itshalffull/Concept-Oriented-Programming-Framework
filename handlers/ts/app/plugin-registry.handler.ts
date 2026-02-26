// PluginRegistry Concept Implementation
import type { ConceptHandler } from '@clef/runtime';

export const pluginRegistryHandler: ConceptHandler = {
  async register(input, storage) {
    const type = input.type as string;
    const name = input.name as string;
    const metadata = input.metadata as string;

    // Check if plugin already registered (idempotent)
    const existing = await storage.get('pluginDefinition', name);
    if (existing && existing.type === type) {
      return { variant: 'exists', plugin: existing.id || name };
    }

    const parsedMetadata = typeof metadata === 'string' ? JSON.parse(metadata) : metadata;

    await storage.put('pluginDefinition', name, {
      id: name,
      type,
      name,
      metadata: parsedMetadata,
      registeredAt: new Date().toISOString(),
    });

    return { variant: 'ok', plugin: name };
  },

  async discover(input, storage) {
    const type = input.type as string;

    const allDefinitions = await storage.find('pluginDefinition', { type });
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

    const definition = await storage.get('pluginDefinition', plugin);
    if (!definition) {
      return { variant: 'notfound' };
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

    const allDefinitions = await storage.find('pluginDefinition', { type });
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
    const allDefinitions = await storage.find('pluginDefinition', { type });

    for (const def of allDefinitions) {
      const id = def.id as string;
      const updated = { ...def, ...parsedAlterations };
      await storage.put('pluginDefinition', id, updated);
    }

    return { variant: 'ok' };
  },

  async derivePlugins(input, storage) {
    const plugin = input.plugin as string;
    const config = input.config as string;

    const baseDefinition = await storage.get('pluginDefinition', plugin);
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

    await storage.put('pluginDefinition', derivedId, derived);

    return { variant: 'ok', derived: JSON.stringify(derived) };
  },
};
