// generated: gcpsmprovider.types.ts

export interface GcpSmProviderFetchInput {
  secretId: string;
  version: string;
}

export type GcpSmProviderFetchOutput =
  { variant: "ok"; value: string; versionId: string; projectId: string }
  | { variant: "iamBindingMissing"; secretId: string; principal: string }
  | { variant: "versionDisabled"; secretId: string; version: string }
  | { variant: "secretNotFound"; secretId: string; projectId: string };

export interface GcpSmProviderRotateInput {
  secretId: string;
}

export type GcpSmProviderRotateOutput =
  { variant: "ok"; secretId: string; newVersionId: string };

