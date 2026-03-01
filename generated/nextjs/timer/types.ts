// Timer — types.ts
// Time-based triggers for process execution: absolute dates, relative durations, and recurring cycles.
// Status lifecycle: set -> active -> fired | cancelled.

export interface TimerStorage {
  readonly get: (relation: string, key: string) => Promise<Record<string, unknown> | null>;
  readonly put: (relation: string, key: string, value: Record<string, unknown>) => Promise<void>;
  readonly delete: (relation: string, key: string) => Promise<boolean>;
  readonly find: (relation: string, filter?: Record<string, unknown>) => Promise<readonly Record<string, unknown>[]>;
}

// --- Status ---

export type TimerStatus = 'set' | 'active' | 'fired' | 'cancelled';

export type TimerType = 'date' | 'duration' | 'cycle';

// --- SetTimer ---

export interface TimerSetTimerInput {
  readonly run_ref: string;
  readonly timer_type: TimerType;
  readonly specification: string;
  readonly purpose_tag: string;
  readonly context_ref: string;
}

export interface TimerSetTimerOutputOk {
  readonly variant: 'ok';
  readonly timer_id: string;
  readonly run_ref: string;
  readonly next_fire_at: string;
}

export interface TimerSetTimerOutputInvalidSpec {
  readonly variant: 'invalid_spec';
  readonly specification: string;
}

export type TimerSetTimerOutput = TimerSetTimerOutputOk | TimerSetTimerOutputInvalidSpec;

// --- Fire ---

export interface TimerFireInput {
  readonly timer_id: string;
}

export interface TimerFireOutputOk {
  readonly variant: 'ok';
  readonly timer_id: string;
  readonly run_ref: string;
  readonly purpose_tag: string;
  readonly context_ref: string;
}

export interface TimerFireOutputNotActive {
  readonly variant: 'not_active';
  readonly timer_id: string;
}

export type TimerFireOutput = TimerFireOutputOk | TimerFireOutputNotActive;

// --- Cancel ---

export interface TimerCancelInput {
  readonly timer_id: string;
}

export interface TimerCancelOutputOk {
  readonly variant: 'ok';
  readonly timer_id: string;
}

export interface TimerCancelOutputNotActive {
  readonly variant: 'not_active';
  readonly timer_id: string;
}

export type TimerCancelOutput = TimerCancelOutputOk | TimerCancelOutputNotActive;

// --- Reset ---

export interface TimerResetInput {
  readonly timer_id: string;
  readonly specification: string;
}

export interface TimerResetOutputOk {
  readonly variant: 'ok';
  readonly timer_id: string;
  readonly next_fire_at: string;
}

export interface TimerResetOutputNotFound {
  readonly variant: 'not_found';
  readonly timer_id: string;
}

export type TimerResetOutput = TimerResetOutputOk | TimerResetOutputNotFound;

// --- Variant constructors ---

export const setTimerOk = (timer_id: string, run_ref: string, next_fire_at: string): TimerSetTimerOutput =>
  ({ variant: 'ok', timer_id, run_ref, next_fire_at } as TimerSetTimerOutput);

export const setTimerInvalidSpec = (specification: string): TimerSetTimerOutput =>
  ({ variant: 'invalid_spec', specification } as TimerSetTimerOutput);

export const fireOk = (timer_id: string, run_ref: string, purpose_tag: string, context_ref: string): TimerFireOutput =>
  ({ variant: 'ok', timer_id, run_ref, purpose_tag, context_ref } as TimerFireOutput);

export const fireNotActive = (timer_id: string): TimerFireOutput =>
  ({ variant: 'not_active', timer_id } as TimerFireOutput);

export const cancelOk = (timer_id: string): TimerCancelOutput =>
  ({ variant: 'ok', timer_id } as TimerCancelOutput);

export const cancelNotActive = (timer_id: string): TimerCancelOutput =>
  ({ variant: 'not_active', timer_id } as TimerCancelOutput);

export const resetOk = (timer_id: string, next_fire_at: string): TimerResetOutput =>
  ({ variant: 'ok', timer_id, next_fire_at } as TimerResetOutput);

export const resetNotFound = (timer_id: string): TimerResetOutput =>
  ({ variant: 'not_found', timer_id } as TimerResetOutput);
