// generated: checkpoint.types.ts

export interface CheckpointCaptureInput {
  runRef: string;
  runState: string;
  variablesSnapshot: string;
  tokenSnapshot: string;
  eventCursor: number;
}

export type CheckpointCaptureOutput =
  { variant: "ok"; checkpoint: string; timestamp: string };

export interface CheckpointRestoreInput {
  checkpoint: string;
}

export type CheckpointRestoreOutput =
  | { variant: "ok"; checkpoint: string; runState: string; variablesSnapshot: string; tokenSnapshot: string; eventCursor: number }
  | { variant: "notFound"; checkpoint: string };

export interface CheckpointFindLatestInput {
  runRef: string;
}

export type CheckpointFindLatestOutput =
  | { variant: "ok"; checkpoint: string }
  | { variant: "none"; runRef: string };

export interface CheckpointPruneInput {
  runRef: string;
  keepCount: number;
}

export type CheckpointPruneOutput =
  { variant: "ok"; pruned: number };
