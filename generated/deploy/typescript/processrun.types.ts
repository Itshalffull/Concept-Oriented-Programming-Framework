// generated: processrun.types.ts

export interface ProcessRunStartInput {
  spec_ref: string;
  spec_version: number;
  input: string;
}

export type ProcessRunStartOutput =
  | { variant: "ok"; run: string; spec_ref: string }
  | { variant: "invalid_spec"; spec_ref: string };

export interface ProcessRunStartChildInput {
  spec_ref: string;
  spec_version: number;
  parent_run: string;
  input: string;
}

export type ProcessRunStartChildOutput =
  | { variant: "ok"; run: string; parent_run: string }
  | { variant: "invalid_spec"; spec_ref: string };

export interface ProcessRunCompleteInput {
  run: string;
  output: string;
}

export type ProcessRunCompleteOutput =
  | { variant: "ok"; run: string }
  | { variant: "not_running"; run: string };

export interface ProcessRunFailInput {
  run: string;
  error: string;
}

export type ProcessRunFailOutput =
  | { variant: "ok"; run: string; error: string }
  | { variant: "not_running"; run: string };

export interface ProcessRunCancelInput {
  run: string;
}

export type ProcessRunCancelOutput =
  | { variant: "ok"; run: string }
  | { variant: "not_cancellable"; run: string };

export interface ProcessRunSuspendInput {
  run: string;
}

export type ProcessRunSuspendOutput =
  | { variant: "ok"; run: string }
  | { variant: "not_running"; run: string };

export interface ProcessRunResumeInput {
  run: string;
}

export type ProcessRunResumeOutput =
  | { variant: "ok"; run: string }
  | { variant: "not_suspended"; run: string };

export interface ProcessRunGetStatusInput {
  run: string;
}

export type ProcessRunGetStatusOutput =
  | { variant: "ok"; run: string; status: string; spec_ref: string }
  | { variant: "not_found"; run: string };
