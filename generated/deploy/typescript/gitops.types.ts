// generated: gitops.types.ts

export interface GitOpsEmitInput {
  plan: string;
  controller: string;
  repo: string;
  path: string;
}

export type GitOpsEmitOutput =
  { variant: "ok"; manifest: string; files: string[] }
  | { variant: "controllerUnsupported"; controller: string };

export interface GitOpsReconciliationStatusInput {
  manifest: string;
}

export type GitOpsReconciliationStatusOutput =
  { variant: "ok"; manifest: string; status: string; reconciledAt: Date }
  | { variant: "pending"; manifest: string; waitingOn: string[] }
  | { variant: "failed"; manifest: string; reason: string };

