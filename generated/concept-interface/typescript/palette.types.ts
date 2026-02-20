// generated: palette.types.ts

export interface PaletteGenerateInput {
  palette: string;
  name: string;
  seed: string;
}

export type PaletteGenerateOutput =
  { variant: "ok"; palette: string; scale: string }
  | { variant: "invalid"; message: string };

export interface PaletteAssignRoleInput {
  palette: string;
  role: string;
}

export type PaletteAssignRoleOutput =
  { variant: "ok"; palette: string }
  | { variant: "notfound"; message: string };

export interface PaletteCheckContrastInput {
  foreground: string;
  background: string;
}

export type PaletteCheckContrastOutput =
  { variant: "ok"; ratio: number; passesAA: boolean; passesAAA: boolean }
  | { variant: "notfound"; message: string };

