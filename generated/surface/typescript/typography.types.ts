// generated: typography.types.ts

export interface TypographyDefineScaleInput {
  typography: string;
  baseSize: number;
  ratio: number;
  steps: number;
}

export type TypographyDefineScaleOutput =
  { variant: "ok"; typography: string; scale: string }
  | { variant: "invalid"; message: string };

export interface TypographyDefineFontStackInput {
  typography: string;
  name: string;
  fonts: string;
  category: string;
}

export type TypographyDefineFontStackOutput =
  { variant: "ok"; typography: string }
  | { variant: "duplicate"; message: string };

export interface TypographyDefineStyleInput {
  typography: string;
  name: string;
  config: string;
}

export type TypographyDefineStyleOutput =
  { variant: "ok"; typography: string }
  | { variant: "invalid"; message: string };

