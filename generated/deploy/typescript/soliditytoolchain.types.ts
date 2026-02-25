// generated: soliditytoolchain.types.ts

export interface SolidityToolchainResolveInput {
  platform: string;
  versionConstraint: string | undefined;
}

export type SolidityToolchainResolveOutput =
  { variant: "ok"; toolchain: string; solcPath: string; version: string; capabilities: string[] }
  | { variant: "notInstalled"; installHint: string }
  | { variant: "evmVersionUnsupported"; requested: string; supported: string[] };

export interface SolidityToolchainRegisterInput {}

export type SolidityToolchainRegisterOutput =
  { variant: "ok"; name: string; language: string; capabilities: string[] };
