// generated: llmcall.types.ts

export interface LlmCallRequestInput {
  stepRef: string;
  model: string;
  prompt: string;
  outputSchema: string;
  maxAttempts: number;
}

export type LlmCallRequestOutput =
  { variant: "ok"; call: string; stepRef: string; model: string };

export interface LlmCallRecordResponseInput {
  call: string;
  rawOutput: string;
  inputTokens: number;
  outputTokens: number;
}

export type LlmCallRecordResponseOutput =
  | { variant: "ok"; call: string }
  | { variant: "providerError"; call: string; message: string };

export interface LlmCallValidateInput {
  call: string;
}

export type LlmCallValidateOutput =
  | { variant: "valid"; call: string; stepRef: string; validatedOutput: string }
  | { variant: "invalid"; call: string; errors: string; attemptCount: number; maxAttempts: number };

export interface LlmCallRepairInput {
  call: string;
  errors: string;
}

export type LlmCallRepairOutput =
  | { variant: "ok"; call: string }
  | { variant: "maxAttemptsReached"; call: string; stepRef: string };

export interface LlmCallAcceptInput {
  call: string;
}

export type LlmCallAcceptOutput =
  { variant: "ok"; call: string; stepRef: string; output: string };

export interface LlmCallRejectInput {
  call: string;
  reason: string;
}

export type LlmCallRejectOutput =
  { variant: "ok"; call: string; stepRef: string; reason: string };
