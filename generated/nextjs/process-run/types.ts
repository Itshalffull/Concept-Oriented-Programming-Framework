// ProcessRun — types.ts
// Top-level process execution instance with parent-child relationships.
// Status lifecycle: pending -> running -> completed|failed|cancelled, running <-> suspended.

export interface ProcessRunStorage {
  readonly get: (relation: string, key: string) => Promise<Record<string, unknown> | null>;
  readonly put: (relation: string, key: string, value: Record<string, unknown>) => Promise<void>;
  readonly delete: (relation: string, key: string) => Promise<boolean>;
  readonly find: (relation: string, filter?: Record<string, unknown>) => Promise<readonly Record<string, unknown>[]>;
}

export interface ProcessRunStartInput {
  readonly run_ref: string;
  readonly spec_id: string;
  readonly input_data: string;
}

export interface ProcessRunStartOutputOk {
  readonly variant: 'ok';
  readonly run_ref: string;
  readonly status: string;
}

export interface ProcessRunStartOutputAlreadyExists {
  readonly variant: 'already_exists';
  readonly run_ref: string;
}

export type ProcessRunStartOutput = ProcessRunStartOutputOk | ProcessRunStartOutputAlreadyExists;

export interface ProcessRunStartChildInput {
  readonly parent_run_ref: string;
  readonly child_run_ref: string;
  readonly spec_id: string;
  readonly input_data: string;
}

export interface ProcessRunStartChildOutputOk {
  readonly variant: 'ok';
  readonly child_run_ref: string;
  readonly parent_run_ref: string;
  readonly status: string;
}

export interface ProcessRunStartChildOutputParentNotFound {
  readonly variant: 'parent_not_found';
  readonly parent_run_ref: string;
}

export interface ProcessRunStartChildOutputParentNotRunning {
  readonly variant: 'parent_not_running';
  readonly parent_run_ref: string;
  readonly current_status: string;
}

export type ProcessRunStartChildOutput =
  | ProcessRunStartChildOutputOk
  | ProcessRunStartChildOutputParentNotFound
  | ProcessRunStartChildOutputParentNotRunning;

export interface ProcessRunCompleteInput {
  readonly run_ref: string;
  readonly output_data: string;
}

export interface ProcessRunCompleteOutputOk {
  readonly variant: 'ok';
  readonly run_ref: string;
  readonly status: string;
}

export interface ProcessRunCompleteOutputNotFound {
  readonly variant: 'not_found';
  readonly run_ref: string;
}

export interface ProcessRunCompleteOutputInvalidTransition {
  readonly variant: 'invalid_transition';
  readonly run_ref: string;
  readonly current_status: string;
}

export type ProcessRunCompleteOutput =
  | ProcessRunCompleteOutputOk
  | ProcessRunCompleteOutputNotFound
  | ProcessRunCompleteOutputInvalidTransition;

export interface ProcessRunFailInput {
  readonly run_ref: string;
  readonly error_code: string;
  readonly error_message: string;
}

export interface ProcessRunFailOutputOk {
  readonly variant: 'ok';
  readonly run_ref: string;
  readonly status: string;
}

export interface ProcessRunFailOutputNotFound {
  readonly variant: 'not_found';
  readonly run_ref: string;
}

export interface ProcessRunFailOutputInvalidTransition {
  readonly variant: 'invalid_transition';
  readonly run_ref: string;
  readonly current_status: string;
}

export type ProcessRunFailOutput =
  | ProcessRunFailOutputOk
  | ProcessRunFailOutputNotFound
  | ProcessRunFailOutputInvalidTransition;

export interface ProcessRunCancelInput {
  readonly run_ref: string;
  readonly reason: string;
}

export interface ProcessRunCancelOutputOk {
  readonly variant: 'ok';
  readonly run_ref: string;
  readonly status: string;
}

export interface ProcessRunCancelOutputNotFound {
  readonly variant: 'not_found';
  readonly run_ref: string;
}

export interface ProcessRunCancelOutputInvalidTransition {
  readonly variant: 'invalid_transition';
  readonly run_ref: string;
  readonly current_status: string;
}

export type ProcessRunCancelOutput =
  | ProcessRunCancelOutputOk
  | ProcessRunCancelOutputNotFound
  | ProcessRunCancelOutputInvalidTransition;

export interface ProcessRunSuspendInput {
  readonly run_ref: string;
  readonly reason: string;
}

export interface ProcessRunSuspendOutputOk {
  readonly variant: 'ok';
  readonly run_ref: string;
  readonly status: string;
}

export interface ProcessRunSuspendOutputNotFound {
  readonly variant: 'not_found';
  readonly run_ref: string;
}

export interface ProcessRunSuspendOutputInvalidTransition {
  readonly variant: 'invalid_transition';
  readonly run_ref: string;
  readonly current_status: string;
}

export type ProcessRunSuspendOutput =
  | ProcessRunSuspendOutputOk
  | ProcessRunSuspendOutputNotFound
  | ProcessRunSuspendOutputInvalidTransition;

export interface ProcessRunResumeInput {
  readonly run_ref: string;
}

export interface ProcessRunResumeOutputOk {
  readonly variant: 'ok';
  readonly run_ref: string;
  readonly status: string;
}

export interface ProcessRunResumeOutputNotFound {
  readonly variant: 'not_found';
  readonly run_ref: string;
}

export interface ProcessRunResumeOutputInvalidTransition {
  readonly variant: 'invalid_transition';
  readonly run_ref: string;
  readonly current_status: string;
}

export type ProcessRunResumeOutput =
  | ProcessRunResumeOutputOk
  | ProcessRunResumeOutputNotFound
  | ProcessRunResumeOutputInvalidTransition;

export interface ProcessRunGetStatusInput {
  readonly run_ref: string;
}

export interface ProcessRunGetStatusOutputOk {
  readonly variant: 'ok';
  readonly run_ref: string;
  readonly spec_id: string;
  readonly status: string;
  readonly parent_run_ref: string | null;
  readonly input_data: string;
  readonly output_data: string | null;
}

export interface ProcessRunGetStatusOutputNotFound {
  readonly variant: 'not_found';
  readonly run_ref: string;
}

export type ProcessRunGetStatusOutput = ProcessRunGetStatusOutputOk | ProcessRunGetStatusOutputNotFound;

// --- Variant constructors ---

export const startOk = (run_ref: string, status: string): ProcessRunStartOutput =>
  ({ variant: 'ok', run_ref, status } as ProcessRunStartOutput);

export const startAlreadyExists = (run_ref: string): ProcessRunStartOutput =>
  ({ variant: 'already_exists', run_ref } as ProcessRunStartOutput);

export const startChildOk = (child_run_ref: string, parent_run_ref: string, status: string): ProcessRunStartChildOutput =>
  ({ variant: 'ok', child_run_ref, parent_run_ref, status } as ProcessRunStartChildOutput);

export const startChildParentNotFound = (parent_run_ref: string): ProcessRunStartChildOutput =>
  ({ variant: 'parent_not_found', parent_run_ref } as ProcessRunStartChildOutput);

export const startChildParentNotRunning = (parent_run_ref: string, current_status: string): ProcessRunStartChildOutput =>
  ({ variant: 'parent_not_running', parent_run_ref, current_status } as ProcessRunStartChildOutput);

export const completeOk = (run_ref: string, status: string): ProcessRunCompleteOutput =>
  ({ variant: 'ok', run_ref, status } as ProcessRunCompleteOutput);

export const completeNotFound = (run_ref: string): ProcessRunCompleteOutput =>
  ({ variant: 'not_found', run_ref } as ProcessRunCompleteOutput);

export const completeInvalidTransition = (run_ref: string, current_status: string): ProcessRunCompleteOutput =>
  ({ variant: 'invalid_transition', run_ref, current_status } as ProcessRunCompleteOutput);

export const failOk = (run_ref: string, status: string): ProcessRunFailOutput =>
  ({ variant: 'ok', run_ref, status } as ProcessRunFailOutput);

export const failNotFound = (run_ref: string): ProcessRunFailOutput =>
  ({ variant: 'not_found', run_ref } as ProcessRunFailOutput);

export const failInvalidTransition = (run_ref: string, current_status: string): ProcessRunFailOutput =>
  ({ variant: 'invalid_transition', run_ref, current_status } as ProcessRunFailOutput);

export const cancelOk = (run_ref: string, status: string): ProcessRunCancelOutput =>
  ({ variant: 'ok', run_ref, status } as ProcessRunCancelOutput);

export const cancelNotFound = (run_ref: string): ProcessRunCancelOutput =>
  ({ variant: 'not_found', run_ref } as ProcessRunCancelOutput);

export const cancelInvalidTransition = (run_ref: string, current_status: string): ProcessRunCancelOutput =>
  ({ variant: 'invalid_transition', run_ref, current_status } as ProcessRunCancelOutput);

export const suspendOk = (run_ref: string, status: string): ProcessRunSuspendOutput =>
  ({ variant: 'ok', run_ref, status } as ProcessRunSuspendOutput);

export const suspendNotFound = (run_ref: string): ProcessRunSuspendOutput =>
  ({ variant: 'not_found', run_ref } as ProcessRunSuspendOutput);

export const suspendInvalidTransition = (run_ref: string, current_status: string): ProcessRunSuspendOutput =>
  ({ variant: 'invalid_transition', run_ref, current_status } as ProcessRunSuspendOutput);

export const resumeOk = (run_ref: string, status: string): ProcessRunResumeOutput =>
  ({ variant: 'ok', run_ref, status } as ProcessRunResumeOutput);

export const resumeNotFound = (run_ref: string): ProcessRunResumeOutput =>
  ({ variant: 'not_found', run_ref } as ProcessRunResumeOutput);

export const resumeInvalidTransition = (run_ref: string, current_status: string): ProcessRunResumeOutput =>
  ({ variant: 'invalid_transition', run_ref, current_status } as ProcessRunResumeOutput);

export const getStatusOk = (
  run_ref: string, spec_id: string, status: string,
  parent_run_ref: string | null, input_data: string, output_data: string | null,
): ProcessRunGetStatusOutput =>
  ({ variant: 'ok', run_ref, spec_id, status, parent_run_ref, input_data, output_data } as ProcessRunGetStatusOutput);

export const getStatusNotFound = (run_ref: string): ProcessRunGetStatusOutput =>
  ({ variant: 'not_found', run_ref } as ProcessRunGetStatusOutput);
