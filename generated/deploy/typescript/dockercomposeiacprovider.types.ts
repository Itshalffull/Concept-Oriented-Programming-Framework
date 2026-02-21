// generated: dockercomposeiacprovider.types.ts

export interface DockerComposeIacProviderGenerateInput {
  plan: string;
}

export type DockerComposeIacProviderGenerateOutput =
  { variant: "ok"; composeFile: string; files: string[] };

export interface DockerComposeIacProviderPreviewInput {
  composeFile: string;
}

export type DockerComposeIacProviderPreviewOutput =
  { variant: "ok"; composeFile: string; toCreate: number; toUpdate: number; toDelete: number };

export interface DockerComposeIacProviderApplyInput {
  composeFile: string;
}

export type DockerComposeIacProviderApplyOutput =
  { variant: "ok"; composeFile: string; created: string[]; updated: string[] }
  | { variant: "portConflict"; port: number; existingService: string };

export interface DockerComposeIacProviderTeardownInput {
  composeFile: string;
}

export type DockerComposeIacProviderTeardownOutput =
  { variant: "ok"; composeFile: string; destroyed: string[] };

