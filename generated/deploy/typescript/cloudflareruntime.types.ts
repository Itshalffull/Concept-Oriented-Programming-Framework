// generated: cloudflareruntime.types.ts

export interface CloudflareRuntimeProvisionInput {
  concept: string;
  accountId: string;
  routes: string[];
}

export type CloudflareRuntimeProvisionOutput =
  { variant: "ok"; worker: string; scriptName: string; endpoint: string }
  | { variant: "routeConflict"; route: string; existingWorker: string };

export interface CloudflareRuntimeDeployInput {
  worker: string;
  scriptContent: string;
}

export type CloudflareRuntimeDeployOutput =
  { variant: "ok"; worker: string; version: string }
  | { variant: "scriptTooLarge"; worker: string; sizeBytes: number; limitBytes: number };

export interface CloudflareRuntimeSetTrafficWeightInput {
  worker: string;
  weight: number;
}

export type CloudflareRuntimeSetTrafficWeightOutput =
  { variant: "ok"; worker: string };

export interface CloudflareRuntimeRollbackInput {
  worker: string;
  targetVersion: string;
}

export type CloudflareRuntimeRollbackOutput =
  { variant: "ok"; worker: string; restoredVersion: string };

export interface CloudflareRuntimeDestroyInput {
  worker: string;
}

export type CloudflareRuntimeDestroyOutput =
  { variant: "ok"; worker: string };

