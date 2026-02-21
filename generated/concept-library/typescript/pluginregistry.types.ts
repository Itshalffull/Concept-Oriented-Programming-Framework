// generated: pluginregistry.types.ts

export interface PluginRegistryDiscoverInput {
  type: string;
}

export type PluginRegistryDiscoverOutput =
  { variant: "ok"; plugins: string };

export interface PluginRegistryCreateInstanceInput {
  plugin: string;
  config: string;
}

export type PluginRegistryCreateInstanceOutput =
  { variant: "ok"; instance: string }
  | { variant: "notfound" };

export interface PluginRegistryGetDefinitionsInput {
  type: string;
}

export type PluginRegistryGetDefinitionsOutput =
  { variant: "ok"; definitions: string };

export interface PluginRegistryAlterDefinitionsInput {
  type: string;
  alterations: string;
}

export type PluginRegistryAlterDefinitionsOutput =
  { variant: "ok" };

export interface PluginRegistryDerivePluginsInput {
  plugin: string;
  config: string;
}

export type PluginRegistryDerivePluginsOutput =
  { variant: "ok"; derived: string }
  | { variant: "notfound" };

