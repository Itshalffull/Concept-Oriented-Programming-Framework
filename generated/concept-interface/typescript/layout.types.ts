// generated: layout.types.ts

export interface LayoutCreateInput {
  layout: string;
  name: string;
  kind: string;
}

export type LayoutCreateOutput =
  { variant: "ok"; layout: string }
  | { variant: "invalid"; message: string };

export interface LayoutConfigureInput {
  layout: string;
  config: string;
}

export type LayoutConfigureOutput =
  { variant: "ok"; layout: string }
  | { variant: "notfound"; message: string };

export interface LayoutNestInput {
  parent: string;
  child: string;
}

export type LayoutNestOutput =
  { variant: "ok"; parent: string }
  | { variant: "cycle"; message: string };

export interface LayoutSetResponsiveInput {
  layout: string;
  breakpoints: string;
}

export type LayoutSetResponsiveOutput =
  { variant: "ok"; layout: string }
  | { variant: "notfound"; message: string };

export interface LayoutRemoveInput {
  layout: string;
}

export type LayoutRemoveOutput =
  { variant: "ok"; layout: string }
  | { variant: "notfound"; message: string };

