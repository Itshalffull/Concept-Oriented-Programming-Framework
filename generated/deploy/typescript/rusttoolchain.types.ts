// generated: rusttoolchain.types.ts

export interface RustToolchainResolveInput {
  platform: string;
  versionConstraint: string | undefined;
}

export type RustToolchainResolveOutput =
  { variant: "ok"; toolchain: string; rustcPath: string; version: string; capabilities: string[] }
  | { variant: "notInstalled"; installHint: string }
  | { variant: "targetMissing"; target: string; installHint: string };

export interface RustToolchainRegisterInput {}

export type RustToolchainRegisterOutput =
  { variant: "ok"; name: string; language: string; capabilities: string[] };
