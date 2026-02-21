// generated: pulumiprovider.types.ts

export interface PulumiProviderGenerateInput {
  plan: string;
}

export type PulumiProviderGenerateOutput =
  { variant: "ok"; stack: string; files: string[] };

export interface PulumiProviderPreviewInput {
  stack: string;
}

export type PulumiProviderPreviewOutput =
  { variant: "ok"; stack: string; toCreate: number; toUpdate: number; toDelete: number; estimatedCost: number }
  | { variant: "backendUnreachable"; backend: string };

export interface PulumiProviderApplyInput {
  stack: string;
}

export type PulumiProviderApplyOutput =
  { variant: "ok"; stack: string; created: string[]; updated: string[] }
  | { variant: "pluginMissing"; plugin: string; version: string }
  | { variant: "conflictingUpdate"; stack: string; pendingOps: string[] }
  | { variant: "partial"; stack: string; created: string[]; failed: string[] };

export interface PulumiProviderTeardownInput {
  stack: string;
}

export type PulumiProviderTeardownOutput =
  { variant: "ok"; stack: string; destroyed: string[] }
  | { variant: "protectedResource"; stack: string; resource: string };

