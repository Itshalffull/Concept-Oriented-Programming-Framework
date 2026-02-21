// generated: lambdaruntime.types.ts

export interface LambdaRuntimeProvisionInput {
  concept: string;
  memory: number;
  timeout: number;
  region: string;
}

export type LambdaRuntimeProvisionOutput =
  { variant: "ok"; function: string; functionArn: string; endpoint: string }
  | { variant: "quotaExceeded"; region: string; limit: string }
  | { variant: "iamError"; policy: string; reason: string };

export interface LambdaRuntimeDeployInput {
  function: string;
  artifactLocation: string;
}

export type LambdaRuntimeDeployOutput =
  { variant: "ok"; function: string; version: string }
  | { variant: "packageTooLarge"; function: string; sizeBytes: number; limitBytes: number }
  | { variant: "runtimeUnsupported"; function: string; runtime: string };

export interface LambdaRuntimeSetTrafficWeightInput {
  function: string;
  aliasWeight: number;
}

export type LambdaRuntimeSetTrafficWeightOutput =
  { variant: "ok"; function: string };

export interface LambdaRuntimeRollbackInput {
  function: string;
  targetVersion: string;
}

export type LambdaRuntimeRollbackOutput =
  { variant: "ok"; function: string; restoredVersion: string };

export interface LambdaRuntimeDestroyInput {
  function: string;
}

export type LambdaRuntimeDestroyOutput =
  { variant: "ok"; function: string }
  | { variant: "resourceInUse"; function: string; dependents: string[] };

