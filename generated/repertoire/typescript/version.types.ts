// generated: version.types.ts

export interface VersionSnapshotInput {
  version: string;
  entity: string;
  data: string;
  author: string;
}

export type VersionSnapshotOutput =
  { variant: "ok"; version: string };

export interface VersionListVersionsInput {
  entity: string;
}

export type VersionListVersionsOutput =
  { variant: "ok"; versions: string };

export interface VersionRollbackInput {
  version: string;
}

export type VersionRollbackOutput =
  { variant: "ok"; data: string }
  | { variant: "notfound"; message: string };

export interface VersionDiffInput {
  versionA: string;
  versionB: string;
}

export type VersionDiffOutput =
  { variant: "ok"; changes: string }
  | { variant: "notfound"; message: string };

