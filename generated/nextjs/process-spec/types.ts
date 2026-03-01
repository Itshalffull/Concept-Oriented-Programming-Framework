// ProcessSpec — types.ts
// Process specification defining the blueprint for process execution.
// Status lifecycle: draft -> active -> deprecated.

export interface ProcessSpecStorage {
  readonly get: (relation: string, key: string) => Promise<Record<string, unknown> | null>;
  readonly put: (relation: string, key: string, value: Record<string, unknown>) => Promise<void>;
  readonly delete: (relation: string, key: string) => Promise<boolean>;
  readonly find: (relation: string, filter?: Record<string, unknown>) => Promise<readonly Record<string, unknown>[]>;
}

export interface ProcessSpecCreateInput {
  readonly spec_id: string;
  readonly name: string;
  readonly definition: string;
  readonly version: string;
}

export interface ProcessSpecCreateOutputOk {
  readonly variant: 'ok';
  readonly spec_id: string;
  readonly status: string;
}

export interface ProcessSpecCreateOutputAlreadyExists {
  readonly variant: 'already_exists';
  readonly spec_id: string;
}

export type ProcessSpecCreateOutput = ProcessSpecCreateOutputOk | ProcessSpecCreateOutputAlreadyExists;

export interface ProcessSpecPublishInput {
  readonly spec_id: string;
}

export interface ProcessSpecPublishOutputOk {
  readonly variant: 'ok';
  readonly spec_id: string;
  readonly status: string;
}

export interface ProcessSpecPublishOutputNotFound {
  readonly variant: 'not_found';
  readonly spec_id: string;
}

export interface ProcessSpecPublishOutputInvalidTransition {
  readonly variant: 'invalid_transition';
  readonly spec_id: string;
  readonly current_status: string;
}

export type ProcessSpecPublishOutput =
  | ProcessSpecPublishOutputOk
  | ProcessSpecPublishOutputNotFound
  | ProcessSpecPublishOutputInvalidTransition;

export interface ProcessSpecDeprecateInput {
  readonly spec_id: string;
  readonly reason: string;
}

export interface ProcessSpecDeprecateOutputOk {
  readonly variant: 'ok';
  readonly spec_id: string;
  readonly status: string;
}

export interface ProcessSpecDeprecateOutputNotFound {
  readonly variant: 'not_found';
  readonly spec_id: string;
}

export interface ProcessSpecDeprecateOutputInvalidTransition {
  readonly variant: 'invalid_transition';
  readonly spec_id: string;
  readonly current_status: string;
}

export type ProcessSpecDeprecateOutput =
  | ProcessSpecDeprecateOutputOk
  | ProcessSpecDeprecateOutputNotFound
  | ProcessSpecDeprecateOutputInvalidTransition;

export interface ProcessSpecUpdateInput {
  readonly spec_id: string;
  readonly definition: string;
}

export interface ProcessSpecUpdateOutputOk {
  readonly variant: 'ok';
  readonly spec_id: string;
  readonly revision: number;
}

export interface ProcessSpecUpdateOutputNotFound {
  readonly variant: 'not_found';
  readonly spec_id: string;
}

export interface ProcessSpecUpdateOutputNotDraft {
  readonly variant: 'not_draft';
  readonly spec_id: string;
  readonly current_status: string;
}

export type ProcessSpecUpdateOutput =
  | ProcessSpecUpdateOutputOk
  | ProcessSpecUpdateOutputNotFound
  | ProcessSpecUpdateOutputNotDraft;

export interface ProcessSpecGetInput {
  readonly spec_id: string;
}

export interface ProcessSpecGetOutputOk {
  readonly variant: 'ok';
  readonly spec_id: string;
  readonly name: string;
  readonly definition: string;
  readonly version: string;
  readonly status: string;
  readonly revision: number;
}

export interface ProcessSpecGetOutputNotFound {
  readonly variant: 'not_found';
  readonly spec_id: string;
}

export type ProcessSpecGetOutput = ProcessSpecGetOutputOk | ProcessSpecGetOutputNotFound;

// --- Variant constructors ---

export const createOk = (spec_id: string, status: string): ProcessSpecCreateOutput =>
  ({ variant: 'ok', spec_id, status } as ProcessSpecCreateOutput);

export const createAlreadyExists = (spec_id: string): ProcessSpecCreateOutput =>
  ({ variant: 'already_exists', spec_id } as ProcessSpecCreateOutput);

export const publishOk = (spec_id: string, status: string): ProcessSpecPublishOutput =>
  ({ variant: 'ok', spec_id, status } as ProcessSpecPublishOutput);

export const publishNotFound = (spec_id: string): ProcessSpecPublishOutput =>
  ({ variant: 'not_found', spec_id } as ProcessSpecPublishOutput);

export const publishInvalidTransition = (spec_id: string, current_status: string): ProcessSpecPublishOutput =>
  ({ variant: 'invalid_transition', spec_id, current_status } as ProcessSpecPublishOutput);

export const deprecateOk = (spec_id: string, status: string): ProcessSpecDeprecateOutput =>
  ({ variant: 'ok', spec_id, status } as ProcessSpecDeprecateOutput);

export const deprecateNotFound = (spec_id: string): ProcessSpecDeprecateOutput =>
  ({ variant: 'not_found', spec_id } as ProcessSpecDeprecateOutput);

export const deprecateInvalidTransition = (spec_id: string, current_status: string): ProcessSpecDeprecateOutput =>
  ({ variant: 'invalid_transition', spec_id, current_status } as ProcessSpecDeprecateOutput);

export const updateOk = (spec_id: string, revision: number): ProcessSpecUpdateOutput =>
  ({ variant: 'ok', spec_id, revision } as ProcessSpecUpdateOutput);

export const updateNotFound = (spec_id: string): ProcessSpecUpdateOutput =>
  ({ variant: 'not_found', spec_id } as ProcessSpecUpdateOutput);

export const updateNotDraft = (spec_id: string, current_status: string): ProcessSpecUpdateOutput =>
  ({ variant: 'not_draft', spec_id, current_status } as ProcessSpecUpdateOutput);

export const getOk = (
  spec_id: string, name: string, definition: string, version: string, status: string, revision: number,
): ProcessSpecGetOutput =>
  ({ variant: 'ok', spec_id, name, definition, version, status, revision } as ProcessSpecGetOutput);

export const getNotFound = (spec_id: string): ProcessSpecGetOutput =>
  ({ variant: 'not_found', spec_id } as ProcessSpecGetOutput);
