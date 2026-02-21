// generated: iac.types.ts

export interface IaCEmitInput {
  plan: string;
  provider: string;
}

export type IaCEmitOutput =
  { variant: "ok"; output: string; fileCount: number }
  | { variant: "unsupportedResource"; resource: string; provider: string };

export interface IaCPreviewInput {
  plan: string;
  provider: string;
}

export type IaCPreviewOutput =
  { variant: "ok"; toCreate: string[]; toUpdate: string[]; toDelete: string[]; estimatedMonthlyCost: number }
  | { variant: "stateCorrupted"; provider: string; reason: string };

export interface IaCApplyInput {
  plan: string;
  provider: string;
}

export type IaCApplyOutput =
  { variant: "ok"; created: string[]; updated: string[]; deleted: string[] }
  | { variant: "partial"; created: string[]; failed: string[]; reason: string }
  | { variant: "applyFailed"; reason: string };

export interface IaCDetectDriftInput {
  provider: string;
}

export type IaCDetectDriftOutput =
  { variant: "ok"; drifted: string[]; clean: string[] }
  | { variant: "noDrift" };

export interface IaCTeardownInput {
  plan: string;
  provider: string;
}

export type IaCTeardownOutput =
  { variant: "ok"; destroyed: string[] }
  | { variant: "partial"; destroyed: string[]; stuck: string[] };

