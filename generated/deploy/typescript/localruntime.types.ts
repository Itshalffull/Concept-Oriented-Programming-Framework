// generated: localruntime.types.ts

export interface LocalRuntimeProvisionInput {
  concept: string;
  command: string;
  port: number;
}

export type LocalRuntimeProvisionOutput =
  { variant: "ok"; process: string; pid: number; endpoint: string }
  | { variant: "portInUse"; port: number; existingPid: number };

export interface LocalRuntimeDeployInput {
  process: string;
  command: string;
}

export type LocalRuntimeDeployOutput =
  { variant: "ok"; process: string; pid: number };

export interface LocalRuntimeSetTrafficWeightInput {
  process: string;
  weight: number;
}

export type LocalRuntimeSetTrafficWeightOutput =
  { variant: "ok"; process: string };

export interface LocalRuntimeRollbackInput {
  process: string;
  previousCommand: string;
}

export type LocalRuntimeRollbackOutput =
  { variant: "ok"; process: string; pid: number };

export interface LocalRuntimeDestroyInput {
  process: string;
}

export type LocalRuntimeDestroyOutput =
  { variant: "ok"; process: string };

