// generated: steprun.types.ts

export interface StepRunStartInput {
  run_ref: string;
  step_key: string;
  step_type: string;
  input: string;
}

export type StepRunStartOutput =
  | { variant: "ok"; step: string; run_ref: string; step_key: string; step_type: string }
  | { variant: "already_active"; step: string };

export interface StepRunCompleteInput {
  step: string;
  output: string;
}

export type StepRunCompleteOutput =
  | { variant: "ok"; step: string; run_ref: string; step_key: string; output: string }
  | { variant: "not_active"; step: string };

export interface StepRunFailInput {
  step: string;
  error: string;
}

export type StepRunFailOutput =
  | { variant: "error"; step: string; run_ref: string; step_key: string; message: string }
  | { variant: "not_active"; step: string };

export interface StepRunCancelInput {
  step: string;
}

export type StepRunCancelOutput =
  | { variant: "ok"; step: string }
  | { variant: "not_cancellable"; step: string };

export interface StepRunSkipInput {
  step: string;
}

export type StepRunSkipOutput =
  | { variant: "ok"; step: string }
  | { variant: "not_pending"; step: string };

export interface StepRunGetInput {
  step: string;
}

export type StepRunGetOutput =
  | { variant: "ok"; step: string; run_ref: string; step_key: string; status: string; attempt: number }
  | { variant: "not_found"; step: string };
