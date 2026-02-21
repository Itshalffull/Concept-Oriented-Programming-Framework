// generated: gcfruntime.types.ts

export interface GcfRuntimeProvisionInput {
  concept: string;
  projectId: string;
  region: string;
  runtime: string;
  triggerType: string;
}

export type GcfRuntimeProvisionOutput =
  { variant: "ok"; function: string; endpoint: string }
  | { variant: "gen2Required"; concept: string; reason: string }
  | { variant: "triggerConflict"; triggerType: string; existing: string };

export interface GcfRuntimeDeployInput {
  function: string;
  sourceArchive: string;
}

export type GcfRuntimeDeployOutput =
  { variant: "ok"; function: string; version: string }
  | { variant: "buildFailed"; function: string; errors: string[] };

export interface GcfRuntimeSetTrafficWeightInput {
  function: string;
  weight: number;
}

export type GcfRuntimeSetTrafficWeightOutput =
  { variant: "ok"; function: string };

export interface GcfRuntimeRollbackInput {
  function: string;
  targetVersion: string;
}

export type GcfRuntimeRollbackOutput =
  { variant: "ok"; function: string; restoredVersion: string };

export interface GcfRuntimeDestroyInput {
  function: string;
}

export type GcfRuntimeDestroyOutput =
  { variant: "ok"; function: string };

