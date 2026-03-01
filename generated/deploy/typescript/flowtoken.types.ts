// generated: flowtoken.types.ts

export interface FlowTokenEmitInput {
  run_ref: string;
  position: string;
  branch_id: string;
}

export type FlowTokenEmitOutput =
  { variant: "ok"; token: string; run_ref: string; position: string };

export interface FlowTokenConsumeInput {
  token: string;
}

export type FlowTokenConsumeOutput =
  | { variant: "ok"; token: string; run_ref: string; position: string }
  | { variant: "not_active"; token: string };

export interface FlowTokenKillInput {
  token: string;
}

export type FlowTokenKillOutput =
  | { variant: "ok"; token: string }
  | { variant: "not_active"; token: string };

export interface FlowTokenCountActiveInput {
  run_ref: string;
  position: string;
}

export type FlowTokenCountActiveOutput =
  { variant: "ok"; count: number };

export interface FlowTokenListActiveInput {
  run_ref: string;
}

export type FlowTokenListActiveOutput =
  { variant: "ok"; tokens: string };
