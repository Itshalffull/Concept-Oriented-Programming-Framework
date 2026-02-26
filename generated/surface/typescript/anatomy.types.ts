// generated: anatomy.types.ts

export interface AnatomyDefineInput {
  anatomy: string;
  component: string;
  parts: string;
  slots: string;
}

export type AnatomyDefineOutput =
  { variant: "ok"; anatomy: string }
  | { variant: "duplicate"; message: string };

export interface AnatomyGetPartsInput {
  anatomy: string;
}

export type AnatomyGetPartsOutput =
  { variant: "ok"; parts: string }
  | { variant: "notfound"; message: string };

export interface AnatomyGetSlotsInput {
  anatomy: string;
}

export type AnatomyGetSlotsOutput =
  { variant: "ok"; slots: string }
  | { variant: "notfound"; message: string };

export interface AnatomyExtendInput {
  anatomy: string;
  additionalParts: string;
}

export type AnatomyExtendOutput =
  { variant: "ok"; anatomy: string }
  | { variant: "notfound"; message: string };

