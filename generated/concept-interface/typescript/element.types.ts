// generated: element.types.ts

export interface ElementCreateInput {
  element: string;
  kind: string;
  label: string;
  dataType: string;
}

export type ElementCreateOutput =
  { variant: "ok"; element: string }
  | { variant: "invalid"; message: string };

export interface ElementNestInput {
  parent: string;
  child: string;
}

export type ElementNestOutput =
  { variant: "ok"; parent: string }
  | { variant: "invalid"; message: string };

export interface ElementSetConstraintsInput {
  element: string;
  constraints: string;
}

export type ElementSetConstraintsOutput =
  { variant: "ok"; element: string }
  | { variant: "notfound"; message: string };

export interface ElementRemoveInput {
  element: string;
}

export type ElementRemoveOutput =
  { variant: "ok"; element: string }
  | { variant: "notfound"; message: string };

