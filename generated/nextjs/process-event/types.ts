// ProcessEvent — types.ts
// Append-only event stream for process execution audit trails.

export interface ProcessEventStorage {
  readonly get: (relation: string, key: string) => Promise<Record<string, unknown> | null>;
  readonly put: (relation: string, key: string, value: Record<string, unknown>) => Promise<void>;
  readonly delete: (relation: string, key: string) => Promise<boolean>;
  readonly find: (relation: string, filter?: Record<string, unknown>) => Promise<readonly Record<string, unknown>[]>;
}

export interface ProcessEventAppendInput {
  readonly run_ref: string;
  readonly event_type: string;
  readonly payload: string;
}

export interface ProcessEventAppendOutputOk {
  readonly variant: 'ok';
  readonly event: string;
  readonly sequence_num: number;
}

export type ProcessEventAppendOutput = ProcessEventAppendOutputOk;

export interface ProcessEventQueryInput {
  readonly run_ref: string;
  readonly after_seq: number;
  readonly limit: number;
}

export interface ProcessEventQueryOutputOk {
  readonly variant: 'ok';
  readonly events: string;
  readonly count: number;
}

export type ProcessEventQueryOutput = ProcessEventQueryOutputOk;

export interface ProcessEventQueryByTypeInput {
  readonly run_ref: string;
  readonly event_type: string;
  readonly limit: number;
}

export interface ProcessEventQueryByTypeOutputOk {
  readonly variant: 'ok';
  readonly events: string;
  readonly count: number;
}

export type ProcessEventQueryByTypeOutput = ProcessEventQueryByTypeOutputOk;

export interface ProcessEventGetCursorInput {
  readonly run_ref: string;
}

export interface ProcessEventGetCursorOutputOk {
  readonly variant: 'ok';
  readonly last_seq: number;
}

export type ProcessEventGetCursorOutput = ProcessEventGetCursorOutputOk;

export const appendOk = (event: string, sequence_num: number): ProcessEventAppendOutput =>
  ({ variant: 'ok', event, sequence_num } as ProcessEventAppendOutput);

export const queryOk = (events: string, count: number): ProcessEventQueryOutput =>
  ({ variant: 'ok', events, count } as ProcessEventQueryOutput);

export const queryByTypeOk = (events: string, count: number): ProcessEventQueryByTypeOutput =>
  ({ variant: 'ok', events, count } as ProcessEventQueryByTypeOutput);

export const getCursorOk = (last_seq: number): ProcessEventGetCursorOutput =>
  ({ variant: 'ok', last_seq } as ProcessEventGetCursorOutput);
