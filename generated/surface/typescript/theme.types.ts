// generated: theme.types.ts

export interface ThemeCreateInput {
  theme: string;
  name: string;
  overrides: string;
}

export type ThemeCreateOutput =
  { variant: "ok"; theme: string }
  | { variant: "duplicate"; message: string };

export interface ThemeExtendInput {
  theme: string;
  base: string;
  overrides: string;
}

export type ThemeExtendOutput =
  { variant: "ok"; theme: string }
  | { variant: "notfound"; message: string };

export interface ThemeActivateInput {
  theme: string;
  priority: number;
}

export type ThemeActivateOutput =
  { variant: "ok"; theme: string }
  | { variant: "notfound"; message: string };

export interface ThemeDeactivateInput {
  theme: string;
}

export type ThemeDeactivateOutput =
  { variant: "ok"; theme: string }
  | { variant: "notfound"; message: string };

export interface ThemeResolveInput {
  theme: string;
}

export type ThemeResolveOutput =
  { variant: "ok"; tokens: string }
  | { variant: "notfound"; message: string };

