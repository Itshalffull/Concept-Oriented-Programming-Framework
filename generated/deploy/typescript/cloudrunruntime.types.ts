// generated: cloudrunruntime.types.ts

export interface CloudRunRuntimeProvisionInput {
  concept: string;
  projectId: string;
  region: string;
  cpu: number;
  memory: number;
}

export type CloudRunRuntimeProvisionOutput =
  { variant: "ok"; service: string; serviceUrl: string; endpoint: string }
  | { variant: "billingDisabled"; projectId: string }
  | { variant: "regionUnavailable"; region: string };

export interface CloudRunRuntimeDeployInput {
  service: string;
  imageUri: string;
}

export type CloudRunRuntimeDeployOutput =
  { variant: "ok"; service: string; revision: string }
  | { variant: "imageNotFound"; imageUri: string };

export interface CloudRunRuntimeSetTrafficWeightInput {
  service: string;
  weight: number;
}

export type CloudRunRuntimeSetTrafficWeightOutput =
  { variant: "ok"; service: string };

export interface CloudRunRuntimeRollbackInput {
  service: string;
  targetRevision: string;
}

export type CloudRunRuntimeRollbackOutput =
  { variant: "ok"; service: string; restoredRevision: string };

export interface CloudRunRuntimeDestroyInput {
  service: string;
}

export type CloudRunRuntimeDestroyOutput =
  { variant: "ok"; service: string };

