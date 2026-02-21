// generated: vercelruntime.types.ts

export interface VercelRuntimeProvisionInput {
  concept: string;
  teamId: string;
  framework: string;
}

export type VercelRuntimeProvisionOutput =
  { variant: "ok"; project: string; projectId: string; endpoint: string }
  | { variant: "domainConflict"; domain: string; existingProject: string };

export interface VercelRuntimeDeployInput {
  project: string;
  sourceDirectory: string;
}

export type VercelRuntimeDeployOutput =
  { variant: "ok"; project: string; deploymentId: string; deploymentUrl: string }
  | { variant: "buildFailed"; project: string; errors: string[] };

export interface VercelRuntimeSetTrafficWeightInput {
  project: string;
  weight: number;
}

export type VercelRuntimeSetTrafficWeightOutput =
  { variant: "ok"; project: string };

export interface VercelRuntimeRollbackInput {
  project: string;
  targetDeploymentId: string;
}

export type VercelRuntimeRollbackOutput =
  { variant: "ok"; project: string; restoredDeploymentId: string };

export interface VercelRuntimeDestroyInput {
  project: string;
}

export type VercelRuntimeDestroyOutput =
  { variant: "ok"; project: string };

