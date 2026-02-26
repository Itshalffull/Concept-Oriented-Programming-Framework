// generated: displaymode.types.ts

export interface DisplayModeDefineModeInput {
  mode: string;
  name: string;
}

export type DisplayModeDefineModeOutput =
  { variant: "ok"; mode: string }
  | { variant: "exists"; message: string };

export interface DisplayModeConfigureFieldDisplayInput {
  mode: string;
  field: string;
  config: string;
}

export type DisplayModeConfigureFieldDisplayOutput =
  { variant: "ok"; mode: string }
  | { variant: "notfound"; message: string };

export interface DisplayModeConfigureFieldFormInput {
  mode: string;
  field: string;
  config: string;
}

export type DisplayModeConfigureFieldFormOutput =
  { variant: "ok"; mode: string }
  | { variant: "notfound"; message: string };

export interface DisplayModeRenderInModeInput {
  mode: string;
  entity: string;
}

export type DisplayModeRenderInModeOutput =
  { variant: "ok"; output: string }
  | { variant: "notfound"; message: string };

