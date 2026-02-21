// generated: vaultprovider.types.ts

export interface VaultProviderFetchInput {
  path: string;
}

export type VaultProviderFetchOutput =
  { variant: "ok"; value: string; leaseId: string; leaseDuration: number }
  | { variant: "sealed"; address: string }
  | { variant: "tokenExpired"; address: string }
  | { variant: "pathNotFound"; path: string };

export interface VaultProviderRenewLeaseInput {
  leaseId: string;
}

export type VaultProviderRenewLeaseOutput =
  { variant: "ok"; leaseId: string; newDuration: number }
  | { variant: "leaseExpired"; leaseId: string };

export interface VaultProviderRotateInput {
  path: string;
}

export type VaultProviderRotateOutput =
  { variant: "ok"; newVersion: number };

