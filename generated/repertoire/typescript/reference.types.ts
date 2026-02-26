// generated: reference.types.ts

export interface ReferenceAddRefInput {
  source: string;
  target: string;
}

export type ReferenceAddRefOutput =
  { variant: "ok"; source: string; target: string }
  | { variant: "exists"; source: string; target: string };

export interface ReferenceRemoveRefInput {
  source: string;
  target: string;
}

export type ReferenceRemoveRefOutput =
  { variant: "ok"; source: string; target: string }
  | { variant: "notfound"; source: string; target: string };

export interface ReferenceGetRefsInput {
  source: string;
}

export type ReferenceGetRefsOutput =
  { variant: "ok"; targets: string }
  | { variant: "notfound"; source: string };

export interface ReferenceResolveTargetInput {
  target: string;
}

export type ReferenceResolveTargetOutput =
  { variant: "ok"; exists: boolean };

