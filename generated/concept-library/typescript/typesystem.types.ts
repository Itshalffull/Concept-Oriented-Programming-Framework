// generated: typesystem.types.ts

export interface TypeSystemRegisterTypeInput {
  type: string;
  schema: string;
  constraints: string;
}

export type TypeSystemRegisterTypeOutput =
  { variant: "ok"; type: string }
  | { variant: "exists"; message: string };

export interface TypeSystemResolveInput {
  type: string;
}

export type TypeSystemResolveOutput =
  { variant: "ok"; type: string; schema: string }
  | { variant: "notfound"; message: string };

export interface TypeSystemValidateInput {
  type: string;
  value: string;
}

export type TypeSystemValidateOutput =
  { variant: "ok"; valid: boolean }
  | { variant: "notfound"; message: string };

export interface TypeSystemNavigateInput {
  type: string;
  path: string;
}

export type TypeSystemNavigateOutput =
  { variant: "ok"; type: string; schema: string }
  | { variant: "notfound"; message: string };

export interface TypeSystemSerializeInput {
  type: string;
  value: string;
}

export type TypeSystemSerializeOutput =
  { variant: "ok"; serialized: string }
  | { variant: "notfound"; message: string };

