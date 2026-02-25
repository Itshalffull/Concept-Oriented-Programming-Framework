// generated: rustbuilder.types.ts

export interface RustBuilderBuildInput {
  source: string;
  toolchainPath: string;
  platform: string;
  config: { mode: string; features: string[] | undefined };
}

export type RustBuilderBuildOutput =
  { variant: "ok"; build: string; artifactPath: string; artifactHash: string }
  | { variant: "compilationError"; errors: { file: string; line: number; message: string }[] }
  | { variant: "featureConflict"; conflicting: string[] };

export interface RustBuilderTestInput {
  build: string;
  toolchainPath: string;
}

export type RustBuilderTestOutput =
  { variant: "ok"; passed: number; failed: number; skipped: number; duration: number }
  | { variant: "testFailure"; passed: number; failed: number; failures: { test: string; message: string }[] };

export interface RustBuilderPackageInput {
  build: string;
  format: string;
}

export type RustBuilderPackageOutput =
  { variant: "ok"; artifactPath: string; artifactHash: string }
  | { variant: "formatUnsupported"; format: string };

export interface RustBuilderRegisterInput {}

export type RustBuilderRegisterOutput =
  { variant: "ok"; name: string; language: string; capabilities: string[] };
