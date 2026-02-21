// generated: cloudformationprovider.types.ts

export interface CloudFormationProviderGenerateInput {
  plan: string;
}

export type CloudFormationProviderGenerateOutput =
  { variant: "ok"; stack: string; files: string[] };

export interface CloudFormationProviderPreviewInput {
  stack: string;
}

export type CloudFormationProviderPreviewOutput =
  { variant: "ok"; stack: string; changeSetId: string; toCreate: number; toUpdate: number; toDelete: number }
  | { variant: "changeSetEmpty"; stack: string };

export interface CloudFormationProviderApplyInput {
  stack: string;
}

export type CloudFormationProviderApplyOutput =
  { variant: "ok"; stack: string; stackId: string; created: string[]; updated: string[] }
  | { variant: "rollbackComplete"; stack: string; reason: string }
  | { variant: "partial"; stack: string; created: string[]; failed: string[] };

export interface CloudFormationProviderTeardownInput {
  stack: string;
}

export type CloudFormationProviderTeardownOutput =
  { variant: "ok"; stack: string; destroyed: string[] }
  | { variant: "deletionFailed"; stack: string; resource: string; reason: string };

