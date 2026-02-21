// generated: token.types.ts

export interface TokenReplaceInput {
  text: string;
  context: string;
}

export type TokenReplaceOutput =
  { variant: "ok"; result: string };

export interface TokenGetAvailableTokensInput {
  context: string;
}

export type TokenGetAvailableTokensOutput =
  { variant: "ok"; tokens: string };

export interface TokenScanInput {
  text: string;
}

export type TokenScanOutput =
  { variant: "ok"; found: string };

export interface TokenRegisterProviderInput {
  token: string;
  provider: string;
}

export type TokenRegisterProviderOutput =
  { variant: "ok" }
  | { variant: "exists" };

