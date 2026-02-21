// generated: deployplan.types.ts

export interface DeployPlanPlanInput {
  manifest: string;
  environment: string;
}

export type DeployPlanPlanOutput =
  { variant: "ok"; plan: string; graph: string; estimatedDuration: number }
  | { variant: "invalidManifest"; errors: string[] }
  | { variant: "incompleteGraph"; missing: string[] }
  | { variant: "circularDependency"; cycle: string[] }
  | { variant: "transportMismatch"; details: string[] };

export interface DeployPlanValidateInput {
  plan: string;
}

export type DeployPlanValidateOutput =
  { variant: "ok"; plan: string; warnings: string[] }
  | { variant: "migrationRequired"; plan: string; concepts: string[]; fromVersions: number[]; toVersions: number[] }
  | { variant: "schemaIncompatible"; details: string[] };

export interface DeployPlanExecuteInput {
  plan: string;
}

export type DeployPlanExecuteOutput =
  { variant: "ok"; plan: string; duration: number; nodesDeployed: number }
  | { variant: "partial"; plan: string; deployed: string[]; failed: string[] }
  | { variant: "rollbackTriggered"; plan: string; reason: string; rolledBack: string[] }
  | { variant: "rollbackFailed"; plan: string; reason: string; stuck: string[] };

export interface DeployPlanRollbackInput {
  plan: string;
}

export type DeployPlanRollbackOutput =
  { variant: "ok"; plan: string; rolledBack: string[] }
  | { variant: "partial"; plan: string; rolledBack: string[]; stuck: string[] };

export interface DeployPlanStatusInput {
  plan: string;
}

export type DeployPlanStatusOutput =
  { variant: "ok"; plan: string; phase: string; progress: number; activeNodes: string[] }
  | { variant: "notfound"; plan: string };

