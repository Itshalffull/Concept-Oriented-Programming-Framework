// ProcessVariable — types.ts
// Scoped key-value store for process execution state, keyed by composite run_ref::name.

export interface ProcessVariableStorage {
  readonly get: (relation: string, key: string) => Promise<Record<string, unknown> | null>;
  readonly put: (relation: string, key: string, value: Record<string, unknown>) => Promise<void>;
  readonly delete: (relation: string, key: string) => Promise<boolean>;
  readonly find: (relation: string, filter?: Record<string, unknown>) => Promise<readonly Record<string, unknown>[]>;
}

export interface ProcessVariableSetInput {
  readonly run_ref: string;
  readonly name: string;
  readonly value: string;
  readonly var_type: string;
}

export interface ProcessVariableSetOutputOk {
  readonly variant: 'ok';
  readonly key: string;
  readonly version: number;
}

export type ProcessVariableSetOutput = ProcessVariableSetOutputOk;

export interface ProcessVariableGetInput {
  readonly run_ref: string;
  readonly name: string;
}

export interface ProcessVariableGetOutputOk {
  readonly variant: 'ok';
  readonly value: string;
  readonly var_type: string;
  readonly version: number;
}

export interface ProcessVariableGetOutputNotFound {
  readonly variant: 'not_found';
  readonly key: string;
}

export type ProcessVariableGetOutput = ProcessVariableGetOutputOk | ProcessVariableGetOutputNotFound;

export interface ProcessVariableMergeInput {
  readonly run_ref: string;
  readonly name: string;
  readonly partial_value: string;
}

export interface ProcessVariableMergeOutputOk {
  readonly variant: 'ok';
  readonly key: string;
  readonly version: number;
}

export interface ProcessVariableMergeOutputNotFound {
  readonly variant: 'not_found';
  readonly key: string;
}

export type ProcessVariableMergeOutput = ProcessVariableMergeOutputOk | ProcessVariableMergeOutputNotFound;

export interface ProcessVariableDeleteInput {
  readonly run_ref: string;
  readonly name: string;
}

export interface ProcessVariableDeleteOutputOk {
  readonly variant: 'ok';
  readonly key: string;
}

export interface ProcessVariableDeleteOutputNotFound {
  readonly variant: 'not_found';
  readonly key: string;
}

export type ProcessVariableDeleteOutput = ProcessVariableDeleteOutputOk | ProcessVariableDeleteOutputNotFound;

export interface ProcessVariableListInput {
  readonly run_ref: string;
}

export interface ProcessVariableListOutputOk {
  readonly variant: 'ok';
  readonly variables: string;
  readonly count: number;
}

export type ProcessVariableListOutput = ProcessVariableListOutputOk;

export interface ProcessVariableSnapshotInput {
  readonly run_ref: string;
}

export interface ProcessVariableSnapshotOutputOk {
  readonly variant: 'ok';
  readonly snapshot: string;
  readonly count: number;
  readonly taken_at: string;
}

export type ProcessVariableSnapshotOutput = ProcessVariableSnapshotOutputOk;

// --- Variant constructors ---

export const setOk = (key: string, version: number): ProcessVariableSetOutput =>
  ({ variant: 'ok', key, version } as ProcessVariableSetOutput);

export const getOk = (value: string, var_type: string, version: number): ProcessVariableGetOutput =>
  ({ variant: 'ok', value, var_type, version } as ProcessVariableGetOutput);

export const getNotFound = (key: string): ProcessVariableGetOutput =>
  ({ variant: 'not_found', key } as ProcessVariableGetOutput);

export const mergeOk = (key: string, version: number): ProcessVariableMergeOutput =>
  ({ variant: 'ok', key, version } as ProcessVariableMergeOutput);

export const mergeNotFound = (key: string): ProcessVariableMergeOutput =>
  ({ variant: 'not_found', key } as ProcessVariableMergeOutput);

export const deleteOk = (key: string): ProcessVariableDeleteOutput =>
  ({ variant: 'ok', key } as ProcessVariableDeleteOutput);

export const deleteNotFound = (key: string): ProcessVariableDeleteOutput =>
  ({ variant: 'not_found', key } as ProcessVariableDeleteOutput);

export const listOk = (variables: string, count: number): ProcessVariableListOutput =>
  ({ variant: 'ok', variables, count } as ProcessVariableListOutput);

export const snapshotOk = (snapshot: string, count: number, taken_at: string): ProcessVariableSnapshotOutput =>
  ({ variant: 'ok', snapshot, count, taken_at } as ProcessVariableSnapshotOutput);
