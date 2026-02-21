// generated: secret.types.ts

export interface SecretResolveInput {
  name: string;
  provider: string;
}

export type SecretResolveOutput =
  { variant: "ok"; secret: string; version: string }
  | { variant: "notFound"; name: string; provider: string }
  | { variant: "accessDenied"; name: string; provider: string; reason: string }
  | { variant: "expired"; name: string; expiresAt: Date };

export interface SecretExistsInput {
  name: string;
  provider: string;
}

export type SecretExistsOutput =
  { variant: "ok"; name: string; exists: boolean };

export interface SecretRotateInput {
  name: string;
  provider: string;
}

export type SecretRotateOutput =
  { variant: "ok"; secret: string; newVersion: string }
  | { variant: "rotationUnsupported"; name: string; provider: string };

export interface SecretInvalidateCacheInput {
  name: string;
}

export type SecretInvalidateCacheOutput =
  { variant: "ok"; secret: string };

