// generated: processevent.types.ts

export interface ProcessEventAppendInput {
  run_ref: string;
  event_type: string;
  payload: string;
}

export type ProcessEventAppendOutput =
  { variant: "ok"; event: string; sequence_num: number };

export interface ProcessEventQueryInput {
  run_ref: string;
  after_seq: number;
  limit: number;
}

export type ProcessEventQueryOutput =
  { variant: "ok"; events: string; count: number };

export interface ProcessEventQueryByTypeInput {
  run_ref: string;
  event_type: string;
  limit: number;
}

export type ProcessEventQueryByTypeOutput =
  { variant: "ok"; events: string; count: number };

export interface ProcessEventGetCursorInput {
  run_ref: string;
}

export type ProcessEventGetCursorOutput =
  { variant: "ok"; last_seq: number };
