// FlowToken — types.ts
// Flow control tokens that track execution position within a process run.
// Tokens are emitted at positions, consumed when work advances, and killed on cancellation.

export interface FlowTokenStorage {
  readonly get: (relation: string, key: string) => Promise<Record<string, unknown> | null>;
  readonly put: (relation: string, key: string, value: Record<string, unknown>) => Promise<void>;
  readonly delete: (relation: string, key: string) => Promise<boolean>;
  readonly find: (relation: string, filter?: Record<string, unknown>) => Promise<readonly Record<string, unknown>[]>;
}

export interface FlowTokenEmitInput {
  readonly run_ref: string;
  readonly position: string;
  readonly payload: string;
}

export interface FlowTokenEmitOutputOk {
  readonly variant: 'ok';
  readonly token_id: string;
  readonly position: string;
}

export type FlowTokenEmitOutput = FlowTokenEmitOutputOk;

export interface FlowTokenConsumeInput {
  readonly token_id: string;
}

export interface FlowTokenConsumeOutputOk {
  readonly variant: 'ok';
  readonly token_id: string;
}

export interface FlowTokenConsumeOutputNotFound {
  readonly variant: 'not_found';
  readonly token_id: string;
}

export interface FlowTokenConsumeOutputAlreadyConsumed {
  readonly variant: 'already_consumed';
  readonly token_id: string;
}

export type FlowTokenConsumeOutput =
  | FlowTokenConsumeOutputOk
  | FlowTokenConsumeOutputNotFound
  | FlowTokenConsumeOutputAlreadyConsumed;

export interface FlowTokenKillInput {
  readonly token_id: string;
  readonly reason: string;
}

export interface FlowTokenKillOutputOk {
  readonly variant: 'ok';
  readonly token_id: string;
}

export interface FlowTokenKillOutputNotFound {
  readonly variant: 'not_found';
  readonly token_id: string;
}

export type FlowTokenKillOutput = FlowTokenKillOutputOk | FlowTokenKillOutputNotFound;

export interface FlowTokenCountActiveInput {
  readonly run_ref: string;
}

export interface FlowTokenCountActiveOutputOk {
  readonly variant: 'ok';
  readonly count: number;
}

export type FlowTokenCountActiveOutput = FlowTokenCountActiveOutputOk;

export interface FlowTokenListActiveInput {
  readonly run_ref: string;
}

export interface FlowTokenListActiveOutputOk {
  readonly variant: 'ok';
  readonly tokens: string;
  readonly count: number;
}

export type FlowTokenListActiveOutput = FlowTokenListActiveOutputOk;

// --- Variant constructors ---

export const emitOk = (token_id: string, position: string): FlowTokenEmitOutput =>
  ({ variant: 'ok', token_id, position } as FlowTokenEmitOutput);

export const consumeOk = (token_id: string): FlowTokenConsumeOutput =>
  ({ variant: 'ok', token_id } as FlowTokenConsumeOutput);

export const consumeNotFound = (token_id: string): FlowTokenConsumeOutput =>
  ({ variant: 'not_found', token_id } as FlowTokenConsumeOutput);

export const consumeAlreadyConsumed = (token_id: string): FlowTokenConsumeOutput =>
  ({ variant: 'already_consumed', token_id } as FlowTokenConsumeOutput);

export const killOk = (token_id: string): FlowTokenKillOutput =>
  ({ variant: 'ok', token_id } as FlowTokenKillOutput);

export const killNotFound = (token_id: string): FlowTokenKillOutput =>
  ({ variant: 'not_found', token_id } as FlowTokenKillOutput);

export const countActiveOk = (count: number): FlowTokenCountActiveOutput =>
  ({ variant: 'ok', count } as FlowTokenCountActiveOutput);

export const listActiveOk = (tokens: string, count: number): FlowTokenListActiveOutput =>
  ({ variant: 'ok', tokens, count } as FlowTokenListActiveOutput);
