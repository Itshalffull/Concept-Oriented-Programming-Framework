// generated: soliditybuilder.types.ts

export interface SolidityBuilderBuildInput {
  source: string;
  toolchainPath: string;
  platform: string;
  config: { mode: string; features: string[] | undefined };
}

export type SolidityBuilderBuildOutput =
  { variant: "ok"; build: string; artifactPath: string; artifactHash: string }
  | { variant: "compilationError"; errors: { file: string; line: number; message: string }[] }
  | { variant: "pragmaMismatch"; required: string; installed: string };

export interface SolidityBuilderTestInput {
  build: string;
  toolchainPath: string;
}

export type SolidityBuilderTestOutput =
  { variant: "ok"; passed: number; failed: number; skipped: number; duration: number }
  | { variant: "testFailure"; passed: number; failed: number; failures: { test: string; message: string }[] };

export interface SolidityBuilderPackageInput {
  build: string;
  format: string;
}

export type SolidityBuilderPackageOutput =
  { variant: "ok"; artifactPath: string; artifactHash: string }
  | { variant: "formatUnsupported"; format: string };

export interface SolidityBuilderRegisterInput {}

export type SolidityBuilderRegisterOutput =
  { variant: "ok"; name: string; language: string; capabilities: string[] };
