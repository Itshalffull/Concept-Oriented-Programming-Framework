// CompensationPlan — types.ts
// Saga-style compensating actions for rollback. As forward steps complete,
// their undo actions are registered. On failure, compensations execute in reverse (LIFO) order.
// Status lifecycle: dormant -> triggered -> executing -> completed | failed.

export interface CompensationPlanStorage {
  readonly get: (relation: string, key: string) => Promise<Record<string, unknown> | null>;
  readonly put: (relation: string, key: string, value: Record<string, unknown>) => Promise<void>;
  readonly delete: (relation: string, key: string) => Promise<boolean>;
  readonly find: (relation: string, filter?: Record<string, unknown>) => Promise<readonly Record<string, unknown>[]>;
}

// --- Status ---

export type CompensationPlanStatus = 'dormant' | 'triggered' | 'executing' | 'completed' | 'failed';

// --- Register ---

export interface CompensationPlanRegisterInput {
  readonly run_ref: string;
  readonly step_key: string;
  readonly action_descriptor: string;
}

export interface CompensationPlanRegisterOutputOk {
  readonly variant: 'ok';
  readonly plan_id: string;
}

export type CompensationPlanRegisterOutput = CompensationPlanRegisterOutputOk;

// --- Trigger ---

export interface CompensationPlanTriggerInput {
  readonly run_ref: string;
}

export interface CompensationPlanTriggerOutputOk {
  readonly variant: 'ok';
  readonly plan_id: string;
}

export interface CompensationPlanTriggerOutputEmpty {
  readonly variant: 'empty';
  readonly run_ref: string;
}

export interface CompensationPlanTriggerOutputAlreadyTriggered {
  readonly variant: 'already_triggered';
  readonly run_ref: string;
}

export type CompensationPlanTriggerOutput =
  | CompensationPlanTriggerOutputOk
  | CompensationPlanTriggerOutputEmpty
  | CompensationPlanTriggerOutputAlreadyTriggered;

// --- ExecuteNext ---

export interface CompensationPlanExecuteNextInput {
  readonly plan_id: string;
}

export interface CompensationPlanExecuteNextOutputOk {
  readonly variant: 'ok';
  readonly plan_id: string;
  readonly step_key: string;
  readonly action_descriptor: string;
}

export interface CompensationPlanExecuteNextOutputAllDone {
  readonly variant: 'all_done';
  readonly plan_id: string;
}

export interface CompensationPlanExecuteNextOutputNotFound {
  readonly variant: 'not_found';
  readonly plan_id: string;
}

export type CompensationPlanExecuteNextOutput =
  | CompensationPlanExecuteNextOutputOk
  | CompensationPlanExecuteNextOutputAllDone
  | CompensationPlanExecuteNextOutputNotFound;

// --- MarkCompensationFailed ---

export interface CompensationPlanMarkFailedInput {
  readonly plan_id: string;
  readonly step_key: string;
  readonly error: string;
}

export interface CompensationPlanMarkFailedOutputOk {
  readonly variant: 'ok';
  readonly plan_id: string;
}

export interface CompensationPlanMarkFailedOutputNotFound {
  readonly variant: 'not_found';
  readonly plan_id: string;
}

export type CompensationPlanMarkFailedOutput =
  | CompensationPlanMarkFailedOutputOk
  | CompensationPlanMarkFailedOutputNotFound;

// --- Variant constructors ---

export const registerOk = (plan_id: string): CompensationPlanRegisterOutput =>
  ({ variant: 'ok', plan_id } as CompensationPlanRegisterOutput);

export const triggerOk = (plan_id: string): CompensationPlanTriggerOutput =>
  ({ variant: 'ok', plan_id } as CompensationPlanTriggerOutput);

export const triggerEmpty = (run_ref: string): CompensationPlanTriggerOutput =>
  ({ variant: 'empty', run_ref } as CompensationPlanTriggerOutput);

export const triggerAlreadyTriggered = (run_ref: string): CompensationPlanTriggerOutput =>
  ({ variant: 'already_triggered', run_ref } as CompensationPlanTriggerOutput);

export const executeNextOk = (plan_id: string, step_key: string, action_descriptor: string): CompensationPlanExecuteNextOutput =>
  ({ variant: 'ok', plan_id, step_key, action_descriptor } as CompensationPlanExecuteNextOutput);

export const executeNextAllDone = (plan_id: string): CompensationPlanExecuteNextOutput =>
  ({ variant: 'all_done', plan_id } as CompensationPlanExecuteNextOutput);

export const executeNextNotFound = (plan_id: string): CompensationPlanExecuteNextOutput =>
  ({ variant: 'not_found', plan_id } as CompensationPlanExecuteNextOutput);

export const markFailedOk = (plan_id: string): CompensationPlanMarkFailedOutput =>
  ({ variant: 'ok', plan_id } as CompensationPlanMarkFailedOutput);

export const markFailedNotFound = (plan_id: string): CompensationPlanMarkFailedOutput =>
  ({ variant: 'not_found', plan_id } as CompensationPlanMarkFailedOutput);
