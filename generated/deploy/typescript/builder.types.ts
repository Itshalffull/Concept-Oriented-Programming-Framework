// generated: builder.types.ts

export interface BuilderBuildInput {
  concept: string;
  source: string;
  language: string;
  platform: string;
  config: { mode: string; features: string[] | undefined };
}

export type BuilderBuildOutput =
  { variant: "ok"; build: string; artifactHash: string; artifactLocation: string; duration: number }
  | { variant: "compilationError"; concept: string; language: string; errors: { file: string; line: number; message: string }[] }
  | { variant: "testFailure"; concept: string; language: string; passed: number; failed: number; failures: { test: string; message: string }[] }
  | { variant: "toolchainError"; concept: string; language: string; reason: string };

export interface BuilderBuildAllInput {
  concepts: string[];
  source: string;
  targets: { language: string; platform: string }[];
  config: { mode: string; features: string[] | undefined };
}

export type BuilderBuildAllOutput =
  { variant: "ok"; results: { concept: string; language: string; artifactHash: string; duration: number }[] }
  | { variant: "partial"; completed: { concept: string; language: string; artifactHash: string }[]; failed: { concept: string; language: string; error: string }[] };

export interface BuilderTestInput {
  concept: string;
  language: string;
  platform: string;
}

export type BuilderTestOutput =
  { variant: "ok"; passed: number; failed: number; skipped: number; duration: number }
  | { variant: "testFailure"; passed: number; failed: number; failures: { test: string; message: string }[] }
  | { variant: "notBuilt"; concept: string; language: string };

export interface BuilderStatusInput {
  build: string;
}

export type BuilderStatusOutput =
  { variant: "ok"; build: string; status: string; duration: number | undefined };

export interface BuilderHistoryInput {
  concept: string;
  language: string | undefined;
}

export type BuilderHistoryOutput =
  { variant: "ok"; builds: { language: string; platform: string; artifactHash: string; duration: number; completedAt: Date; testsPassed: number }[] };
