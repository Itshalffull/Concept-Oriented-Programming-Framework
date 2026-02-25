// generated: typescripttoolchain.types.ts

export interface TypeScriptToolchainResolveInput {
  platform: string;
  versionConstraint: string | undefined;
}

export type TypeScriptToolchainResolveOutput =
  { variant: "ok"; toolchain: string; tscPath: string; version: string; capabilities: string[] }
  | { variant: "notInstalled"; installHint: string }
  | { variant: "nodeVersionMismatch"; installed: string; required: string };

export interface TypeScriptToolchainRegisterInput {}

export type TypeScriptToolchainRegisterOutput =
  { variant: "ok"; name: string; language: string; capabilities: string[] };
