// generated: processspec.types.ts

export interface ProcessSpecStep {
  key: string;
  step_type: string;
  config: string;
}

export interface ProcessSpecEdge {
  from_step: string;
  to_step: string;
  on_variant: string;
  condition_expr: string | null;
  priority: number | null;
}

export interface ProcessSpecCreateInput {
  name: string;
  steps: string;
  edges: string;
}

export type ProcessSpecCreateOutput =
  | { variant: "ok"; spec: string }
  | { variant: "invalid"; message: string };

export interface ProcessSpecPublishInput {
  spec: string;
}

export type ProcessSpecPublishOutput =
  | { variant: "ok"; spec: string; version: number }
  | { variant: "not_found"; spec: string }
  | { variant: "already_active"; spec: string };

export interface ProcessSpecDeprecateInput {
  spec: string;
}

export type ProcessSpecDeprecateOutput =
  | { variant: "ok"; spec: string }
  | { variant: "not_found"; spec: string };

export interface ProcessSpecUpdateInput {
  spec: string;
  steps: string;
  edges: string;
}

export type ProcessSpecUpdateOutput =
  | { variant: "ok"; spec: string; version: number }
  | { variant: "not_draft"; spec: string }
  | { variant: "invalid"; message: string };

export interface ProcessSpecGetInput {
  spec: string;
}

export type ProcessSpecGetOutput =
  | { variant: "ok"; spec: string; name: string; version: number; status: string; steps: string; edges: string }
  | { variant: "not_found"; spec: string };
