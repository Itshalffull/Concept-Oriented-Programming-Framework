// generated: k8sruntime.types.ts

export interface K8sRuntimeProvisionInput {
  concept: string;
  namespace: string;
  cluster: string;
  replicas: number;
}

export type K8sRuntimeProvisionOutput =
  { variant: "ok"; deployment: string; serviceName: string; endpoint: string }
  | { variant: "resourceQuotaExceeded"; namespace: string; resource: string; requested: string; limit: string }
  | { variant: "namespaceNotFound"; namespace: string };

export interface K8sRuntimeDeployInput {
  deployment: string;
  imageUri: string;
}

export type K8sRuntimeDeployOutput =
  { variant: "ok"; deployment: string; revision: string }
  | { variant: "podCrashLoop"; deployment: string; podName: string; restartCount: number }
  | { variant: "imageNotFound"; imageUri: string };

export interface K8sRuntimeSetTrafficWeightInput {
  deployment: string;
  weight: number;
}

export type K8sRuntimeSetTrafficWeightOutput =
  { variant: "ok"; deployment: string };

export interface K8sRuntimeRollbackInput {
  deployment: string;
  targetRevision: string;
}

export type K8sRuntimeRollbackOutput =
  { variant: "ok"; deployment: string; restoredRevision: string };

export interface K8sRuntimeDestroyInput {
  deployment: string;
}

export type K8sRuntimeDestroyOutput =
  { variant: "ok"; deployment: string };

