// generated: processvariable.types.ts

export interface ProcessVariableSetInput {
  run_ref: string;
  name: string;
  value: string;
  value_type: string;
  scope: string;
}

export type ProcessVariableSetOutput =
  { variant: "ok"; var: string };

export interface ProcessVariableGetInput {
  run_ref: string;
  name: string;
}

export type ProcessVariableGetOutput =
  | { variant: "ok"; var: string; value: string; value_type: string }
  | { variant: "not_found"; run_ref: string; name: string };

export interface ProcessVariableMergeInput {
  run_ref: string;
  name: string;
  update: string;
  strategy: string;
}

export type ProcessVariableMergeOutput =
  | { variant: "ok"; var: string; merged_value: string }
  | { variant: "not_found"; run_ref: string; name: string }
  | { variant: "merge_error"; message: string };

export interface ProcessVariableDeleteInput {
  run_ref: string;
  name: string;
}

export type ProcessVariableDeleteOutput =
  | { variant: "ok"; run_ref: string; name: string }
  | { variant: "not_found"; run_ref: string; name: string };

export interface ProcessVariableListInput {
  run_ref: string;
}

export type ProcessVariableListOutput =
  { variant: "ok"; variables: string };

export interface ProcessVariableSnapshotInput {
  run_ref: string;
}

export type ProcessVariableSnapshotOutput =
  { variant: "ok"; snapshot: string };
