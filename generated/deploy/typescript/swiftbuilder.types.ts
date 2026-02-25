// generated: swiftbuilder.types.ts

export interface SwiftBuilderBuildInput {
  source: string;
  toolchainPath: string;
  platform: string;
  config: { mode: string; features: string[] | undefined };
}

export type SwiftBuilderBuildOutput =
  { variant: "ok"; build: string; artifactPath: string; artifactHash: string }
  | { variant: "compilationError"; errors: { file: string; line: number; message: string }[] }
  | { variant: "linkerError"; reason: string };

export interface SwiftBuilderTestInput {
  build: string;
  toolchainPath: string;
}

export type SwiftBuilderTestOutput =
  { variant: "ok"; passed: number; failed: number; skipped: number; duration: number }
  | { variant: "testFailure"; passed: number; failed: number; failures: { test: string; message: string }[] };

export interface SwiftBuilderPackageInput {
  build: string;
  format: string;
}

export type SwiftBuilderPackageOutput =
  { variant: "ok"; artifactPath: string; artifactHash: string }
  | { variant: "formatUnsupported"; format: string };

export interface SwiftBuilderRegisterInput {}

export type SwiftBuilderRegisterOutput =
  { variant: "ok"; name: string; language: string; capabilities: string[] };
