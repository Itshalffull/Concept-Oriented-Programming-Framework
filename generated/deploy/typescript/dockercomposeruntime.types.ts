// generated: dockercomposeruntime.types.ts

export interface DockerComposeRuntimeProvisionInput {
  concept: string;
  composePath: string;
  ports: string[];
}

export type DockerComposeRuntimeProvisionOutput =
  { variant: "ok"; service: string; serviceName: string; endpoint: string }
  | { variant: "portConflict"; port: number; existingService: string };

export interface DockerComposeRuntimeDeployInput {
  service: string;
  imageUri: string;
}

export type DockerComposeRuntimeDeployOutput =
  { variant: "ok"; service: string; containerId: string };

export interface DockerComposeRuntimeSetTrafficWeightInput {
  service: string;
  weight: number;
}

export type DockerComposeRuntimeSetTrafficWeightOutput =
  { variant: "ok"; service: string };

export interface DockerComposeRuntimeRollbackInput {
  service: string;
  targetImage: string;
}

export type DockerComposeRuntimeRollbackOutput =
  { variant: "ok"; service: string; restoredImage: string };

export interface DockerComposeRuntimeDestroyInput {
  service: string;
}

export type DockerComposeRuntimeDestroyOutput =
  { variant: "ok"; service: string };

