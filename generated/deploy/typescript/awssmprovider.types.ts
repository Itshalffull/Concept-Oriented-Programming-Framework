// generated: awssmprovider.types.ts

export interface AwsSmProviderFetchInput {
  secretId: string;
  versionStage: string;
}

export type AwsSmProviderFetchOutput =
  { variant: "ok"; value: string; versionId: string; arn: string }
  | { variant: "kmsKeyInaccessible"; secretId: string; kmsKeyId: string }
  | { variant: "resourceNotFound"; secretId: string }
  | { variant: "decryptionFailed"; secretId: string; reason: string };

export interface AwsSmProviderRotateInput {
  secretId: string;
}

export type AwsSmProviderRotateOutput =
  { variant: "ok"; secretId: string; newVersionId: string }
  | { variant: "rotationInProgress"; secretId: string };

