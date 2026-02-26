// generated: pluginregistry.handler.ts
import type { ConceptStorage } from "@clef/runtime";
import type * as T from "./pluginregistry.types";

export interface PluginRegistryHandler {
  discover(input: T.PluginRegistryDiscoverInput, storage: ConceptStorage):
    Promise<T.PluginRegistryDiscoverOutput>;
  createInstance(input: T.PluginRegistryCreateInstanceInput, storage: ConceptStorage):
    Promise<T.PluginRegistryCreateInstanceOutput>;
  getDefinitions(input: T.PluginRegistryGetDefinitionsInput, storage: ConceptStorage):
    Promise<T.PluginRegistryGetDefinitionsOutput>;
  alterDefinitions(input: T.PluginRegistryAlterDefinitionsInput, storage: ConceptStorage):
    Promise<T.PluginRegistryAlterDefinitionsOutput>;
  derivePlugins(input: T.PluginRegistryDerivePluginsInput, storage: ConceptStorage):
    Promise<T.PluginRegistryDerivePluginsOutput>;
}
