// generated: configsync.types.ts

export interface ConfigSyncExportInput {
  config: string;
}

export type ConfigSyncExportOutput =
  { variant: "ok"; data: string }
  | { variant: "notfound" };

export interface ConfigSyncImportInput {
  config: string;
  data: string;
}

export type ConfigSyncImportOutput =
  { variant: "ok" }
  | { variant: "error"; message: string };

export interface ConfigSyncOverrideInput {
  config: string;
  layer: string;
  values: string;
}

export type ConfigSyncOverrideOutput =
  { variant: "ok" }
  | { variant: "notfound" };

export interface ConfigSyncDiffInput {
  configA: string;
  configB: string;
}

export type ConfigSyncDiffOutput =
  { variant: "ok"; changes: string }
  | { variant: "notfound" };

