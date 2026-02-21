// generated: ecsruntime.types.ts

export interface EcsRuntimeProvisionInput {
  concept: string;
  cpu: number;
  memory: number;
  cluster: string;
}

export type EcsRuntimeProvisionOutput =
  { variant: "ok"; service: string; serviceArn: string; endpoint: string }
  | { variant: "capacityUnavailable"; cluster: string; requested: string }
  | { variant: "clusterNotFound"; cluster: string };

export interface EcsRuntimeDeployInput {
  service: string;
  imageUri: string;
}

export type EcsRuntimeDeployOutput =
  { variant: "ok"; service: string; taskDefinition: string }
  | { variant: "imageNotFound"; imageUri: string }
  | { variant: "healthCheckFailed"; service: string; failedTasks: number };

export interface EcsRuntimeSetTrafficWeightInput {
  service: string;
  weight: number;
}

export type EcsRuntimeSetTrafficWeightOutput =
  { variant: "ok"; service: string };

export interface EcsRuntimeRollbackInput {
  service: string;
  targetTaskDefinition: string;
}

export type EcsRuntimeRollbackOutput =
  { variant: "ok"; service: string };

export interface EcsRuntimeDestroyInput {
  service: string;
}

export type EcsRuntimeDestroyOutput =
  { variant: "ok"; service: string }
  | { variant: "drainTimeout"; service: string; activeConnections: number };

