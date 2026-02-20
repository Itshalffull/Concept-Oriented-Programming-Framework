// generated: signal.types.ts

export interface SignalCreateInput {
  signal: string;
  kind: string;
  initialValue: string;
}

export type SignalCreateOutput =
  { variant: "ok"; signal: string }
  | { variant: "invalid"; message: string };

export interface SignalReadInput {
  signal: string;
}

export type SignalReadOutput =
  { variant: "ok"; signal: string; value: string; version: number }
  | { variant: "notfound"; message: string };

export interface SignalWriteInput {
  signal: string;
  value: string;
}

export type SignalWriteOutput =
  { variant: "ok"; signal: string; version: number }
  | { variant: "readonly"; message: string }
  | { variant: "notfound"; message: string };

export interface SignalBatchInput {
  signals: string;
}

export type SignalBatchOutput =
  { variant: "ok"; count: number }
  | { variant: "partial"; message: string; succeeded: number; failed: number };

export interface SignalDisposeInput {
  signal: string;
}

export type SignalDisposeOutput =
  { variant: "ok"; signal: string }
  | { variant: "notfound"; message: string };

