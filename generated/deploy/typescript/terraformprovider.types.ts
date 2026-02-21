// generated: terraformprovider.types.ts

export interface TerraformProviderGenerateInput {
  plan: string;
}

export type TerraformProviderGenerateOutput =
  { variant: "ok"; workspace: string; files: string[] };

export interface TerraformProviderPreviewInput {
  workspace: string;
}

export type TerraformProviderPreviewOutput =
  { variant: "ok"; workspace: string; toCreate: number; toUpdate: number; toDelete: number }
  | { variant: "stateLocked"; workspace: string; lockId: string; lockedBy: string }
  | { variant: "backendInitRequired"; workspace: string };

export interface TerraformProviderApplyInput {
  workspace: string;
}

export type TerraformProviderApplyOutput =
  { variant: "ok"; workspace: string; created: string[]; updated: string[] }
  | { variant: "stateLocked"; workspace: string; lockId: string }
  | { variant: "partial"; workspace: string; created: string[]; failed: string[] };

export interface TerraformProviderTeardownInput {
  workspace: string;
}

export type TerraformProviderTeardownOutput =
  { variant: "ok"; workspace: string; destroyed: string[] };

