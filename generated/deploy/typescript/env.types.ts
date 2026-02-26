// generated: env.types.ts

export interface EnvResolveInput {
  environment: string;
}

export type EnvResolveOutput =
  { variant: "ok"; environment: string; resolved: string }
  | { variant: "missingBase"; environment: string }
  | { variant: "conflictingOverrides"; environment: string; conflicts: string[] };

export interface EnvPromoteInput {
  fromEnv: string;
  toEnv: string;
  suiteName: string;
}

export type EnvPromoteOutput =
  { variant: "ok"; toEnv: string; version: string }
  | { variant: "notValidated"; fromEnv: string; suiteName: string }
  | { variant: "versionMismatch"; fromEnv: string; toEnv: string; details: string };

export interface EnvDiffInput {
  envA: string;
  envB: string;
}

export type EnvDiffOutput =
  { variant: "ok"; differences: string[] };

