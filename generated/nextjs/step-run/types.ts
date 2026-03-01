// StepRun — types.ts
// Individual step execution within a process run.
// Status lifecycle: pending -> ready -> active -> completed|failed|cancelled|skipped.

export interface StepRunStorage {
  readonly get: (relation: string, key: string) => Promise<Record<string, unknown> | null>;
  readonly put: (relation: string, key: string, value: Record<string, unknown>) => Promise<void>;
  readonly delete: (relation: string, key: string) => Promise<boolean>;
  readonly find: (relation: string, filter?: Record<string, unknown>) => Promise<readonly Record<string, unknown>[]>;
}

export interface StepRunStartInput {
  readonly run_ref: string;
  readonly step_id: string;
  readonly step_name: string;
  readonly input_data: string;
}

export interface StepRunStartOutputOk {
  readonly variant: 'ok';
  readonly step_run_id: string;
  readonly status: string;
}

export interface StepRunStartOutputAlreadyActive {
  readonly variant: 'already_active';
  readonly step_run_id: string;
}

export type StepRunStartOutput = StepRunStartOutputOk | StepRunStartOutputAlreadyActive;

export interface StepRunCompleteInput {
  readonly step_run_id: string;
  readonly output_data: string;
}

export interface StepRunCompleteOutputOk {
  readonly variant: 'ok';
  readonly step_run_id: string;
  readonly status: string;
}

export interface StepRunCompleteOutputNotFound {
  readonly variant: 'not_found';
  readonly step_run_id: string;
}

export interface StepRunCompleteOutputInvalidTransition {
  readonly variant: 'invalid_transition';
  readonly step_run_id: string;
  readonly current_status: string;
}

export type StepRunCompleteOutput =
  | StepRunCompleteOutputOk
  | StepRunCompleteOutputNotFound
  | StepRunCompleteOutputInvalidTransition;

export interface StepRunFailInput {
  readonly step_run_id: string;
  readonly error_code: string;
  readonly error_message: string;
}

export interface StepRunFailOutputOk {
  readonly variant: 'ok';
  readonly step_run_id: string;
  readonly status: string;
}

export interface StepRunFailOutputNotFound {
  readonly variant: 'not_found';
  readonly step_run_id: string;
}

export interface StepRunFailOutputInvalidTransition {
  readonly variant: 'invalid_transition';
  readonly step_run_id: string;
  readonly current_status: string;
}

export type StepRunFailOutput =
  | StepRunFailOutputOk
  | StepRunFailOutputNotFound
  | StepRunFailOutputInvalidTransition;

export interface StepRunCancelInput {
  readonly step_run_id: string;
  readonly reason: string;
}

export interface StepRunCancelOutputOk {
  readonly variant: 'ok';
  readonly step_run_id: string;
  readonly status: string;
}

export interface StepRunCancelOutputNotFound {
  readonly variant: 'not_found';
  readonly step_run_id: string;
}

export interface StepRunCancelOutputInvalidTransition {
  readonly variant: 'invalid_transition';
  readonly step_run_id: string;
  readonly current_status: string;
}

export type StepRunCancelOutput =
  | StepRunCancelOutputOk
  | StepRunCancelOutputNotFound
  | StepRunCancelOutputInvalidTransition;

export interface StepRunSkipInput {
  readonly step_run_id: string;
  readonly reason: string;
}

export interface StepRunSkipOutputOk {
  readonly variant: 'ok';
  readonly step_run_id: string;
  readonly status: string;
}

export interface StepRunSkipOutputNotFound {
  readonly variant: 'not_found';
  readonly step_run_id: string;
}

export interface StepRunSkipOutputInvalidTransition {
  readonly variant: 'invalid_transition';
  readonly step_run_id: string;
  readonly current_status: string;
}

export type StepRunSkipOutput =
  | StepRunSkipOutputOk
  | StepRunSkipOutputNotFound
  | StepRunSkipOutputInvalidTransition;

export interface StepRunGetInput {
  readonly step_run_id: string;
}

export interface StepRunGetOutputOk {
  readonly variant: 'ok';
  readonly step_run_id: string;
  readonly run_ref: string;
  readonly step_id: string;
  readonly step_name: string;
  readonly status: string;
  readonly input_data: string;
  readonly output_data: string | null;
}

export interface StepRunGetOutputNotFound {
  readonly variant: 'not_found';
  readonly step_run_id: string;
}

export type StepRunGetOutput = StepRunGetOutputOk | StepRunGetOutputNotFound;

// --- Variant constructors ---

export const startOk = (step_run_id: string, status: string): StepRunStartOutput =>
  ({ variant: 'ok', step_run_id, status } as StepRunStartOutput);

export const startAlreadyActive = (step_run_id: string): StepRunStartOutput =>
  ({ variant: 'already_active', step_run_id } as StepRunStartOutput);

export const completeOk = (step_run_id: string, status: string): StepRunCompleteOutput =>
  ({ variant: 'ok', step_run_id, status } as StepRunCompleteOutput);

export const completeNotFound = (step_run_id: string): StepRunCompleteOutput =>
  ({ variant: 'not_found', step_run_id } as StepRunCompleteOutput);

export const completeInvalidTransition = (step_run_id: string, current_status: string): StepRunCompleteOutput =>
  ({ variant: 'invalid_transition', step_run_id, current_status } as StepRunCompleteOutput);

export const failOk = (step_run_id: string, status: string): StepRunFailOutput =>
  ({ variant: 'ok', step_run_id, status } as StepRunFailOutput);

export const failNotFound = (step_run_id: string): StepRunFailOutput =>
  ({ variant: 'not_found', step_run_id } as StepRunFailOutput);

export const failInvalidTransition = (step_run_id: string, current_status: string): StepRunFailOutput =>
  ({ variant: 'invalid_transition', step_run_id, current_status } as StepRunFailOutput);

export const cancelOk = (step_run_id: string, status: string): StepRunCancelOutput =>
  ({ variant: 'ok', step_run_id, status } as StepRunCancelOutput);

export const cancelNotFound = (step_run_id: string): StepRunCancelOutput =>
  ({ variant: 'not_found', step_run_id } as StepRunCancelOutput);

export const cancelInvalidTransition = (step_run_id: string, current_status: string): StepRunCancelOutput =>
  ({ variant: 'invalid_transition', step_run_id, current_status } as StepRunCancelOutput);

export const skipOk = (step_run_id: string, status: string): StepRunSkipOutput =>
  ({ variant: 'ok', step_run_id, status } as StepRunSkipOutput);

export const skipNotFound = (step_run_id: string): StepRunSkipOutput =>
  ({ variant: 'not_found', step_run_id } as StepRunSkipOutput);

export const skipInvalidTransition = (step_run_id: string, current_status: string): StepRunSkipOutput =>
  ({ variant: 'invalid_transition', step_run_id, current_status } as StepRunSkipOutput);

export const getOk = (
  step_run_id: string, run_ref: string, step_id: string, step_name: string,
  status: string, input_data: string, output_data: string | null,
): StepRunGetOutput =>
  ({ variant: 'ok', step_run_id, run_ref, step_id, step_name, status, input_data, output_data } as StepRunGetOutput);

export const getNotFound = (step_run_id: string): StepRunGetOutput =>
  ({ variant: 'not_found', step_run_id } as StepRunGetOutput);
