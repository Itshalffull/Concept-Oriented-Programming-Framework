// generated: typescriptbuilder.types.ts

export interface TypeScriptBuilderBuildInput {
  source: string;
  toolchainPath: string;
  platform: string;
  config: { mode: string; features: string[] | undefined };
}

export type TypeScriptBuilderBuildOutput =
  { variant: "ok"; build: string; artifactPath: string; artifactHash: string }
  | { variant: "typeError"; errors: { file: string; line: number; message: string }[] }
  | { variant: "bundleError"; reason: string };

export interface TypeScriptBuilderTestInput {
  build: string;
  toolchainPath: string;
}

export type TypeScriptBuilderTestOutput =
  { variant: "ok"; passed: number; failed: number; skipped: number; duration: number }
  | { variant: "testFailure"; passed: number; failed: number; failures: { test: string; message: string }[] };

export interface TypeScriptBuilderPackageInput {
  build: string;
  format: string;
}

export type TypeScriptBuilderPackageOutput =
  { variant: "ok"; artifactPath: string; artifactHash: string }
  | { variant: "formatUnsupported"; format: string };

export interface TypeScriptBuilderRegisterInput {}

export type TypeScriptBuilderRegisterOutput =
  { variant: "ok"; name: string; language: string; capabilities: string[] };
