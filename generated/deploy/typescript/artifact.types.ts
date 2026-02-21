// generated: artifact.types.ts

export interface ArtifactBuildInput {
  concept: string;
  spec: string;
  implementation: string;
  deps: string[];
}

export type ArtifactBuildOutput =
  { variant: "ok"; artifact: string; hash: string; sizeBytes: number }
  | { variant: "compilationError"; concept: string; errors: string[] };

export interface ArtifactResolveInput {
  hash: string;
}

export type ArtifactResolveOutput =
  { variant: "ok"; artifact: string; location: string }
  | { variant: "notfound"; hash: string };

export interface ArtifactGcInput {
  olderThan: Date;
  keepVersions: number;
}

export type ArtifactGcOutput =
  { variant: "ok"; removed: number; freedBytes: number };

