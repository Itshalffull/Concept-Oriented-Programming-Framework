// generated: runtime.types.ts

export interface RuntimeProvisionInput {
  concept: string;
  runtimeType: string;
  config: string;
}

export type RuntimeProvisionOutput =
  { variant: "ok"; instance: string; endpoint: string }
  | { variant: "alreadyProvisioned"; instance: string; endpoint: string }
  | { variant: "provisionFailed"; concept: string; runtimeType: string; reason: string };

export interface RuntimeDeployInput {
  instance: string;
  artifact: string;
  version: string;
}

export type RuntimeDeployOutput =
  { variant: "ok"; instance: string; endpoint: string }
  | { variant: "deployFailed"; instance: string; reason: string };

export interface RuntimeSetTrafficWeightInput {
  instance: string;
  weight: number;
}

export type RuntimeSetTrafficWeightOutput =
  { variant: "ok"; instance: string; newWeight: number };

export interface RuntimeRollbackInput {
  instance: string;
}

export type RuntimeRollbackOutput =
  { variant: "ok"; instance: string; previousVersion: string }
  | { variant: "noHistory"; instance: string }
  | { variant: "rollbackFailed"; instance: string; reason: string };

export interface RuntimeDestroyInput {
  instance: string;
}

export type RuntimeDestroyOutput =
  { variant: "ok"; instance: string }
  | { variant: "destroyFailed"; instance: string; reason: string };

export interface RuntimeHealthCheckInput {
  instance: string;
}

export type RuntimeHealthCheckOutput =
  { variant: "ok"; instance: string; latencyMs: number }
  | { variant: "unreachable"; instance: string }
  | { variant: "degraded"; instance: string; latencyMs: number };

