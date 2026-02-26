// generated: workflow.types.ts

export interface WorkflowDefineStateInput {
  workflow: string;
  name: string;
  flags: string;
}

export type WorkflowDefineStateOutput =
  { variant: "ok" }
  | { variant: "exists"; message: string };

export interface WorkflowDefineTransitionInput {
  workflow: string;
  from: string;
  to: string;
  label: string;
  guard: string;
}

export type WorkflowDefineTransitionOutput =
  { variant: "ok" }
  | { variant: "error"; message: string };

export interface WorkflowTransitionInput {
  workflow: string;
  entity: string;
  transition: string;
}

export type WorkflowTransitionOutput =
  { variant: "ok"; newState: string }
  | { variant: "notfound"; message: string }
  | { variant: "forbidden"; message: string };

export interface WorkflowGetCurrentStateInput {
  workflow: string;
  entity: string;
}

export type WorkflowGetCurrentStateOutput =
  { variant: "ok"; state: string }
  | { variant: "notfound"; message: string };

