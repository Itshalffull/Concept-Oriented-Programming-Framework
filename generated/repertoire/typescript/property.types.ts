// generated: property.types.ts

export interface PropertySetInput {
  entity: string;
  key: string;
  value: string;
}

export type PropertySetOutput =
  { variant: "ok"; entity: string }
  | { variant: "invalid"; message: string };

export interface PropertyGetInput {
  entity: string;
  key: string;
}

export type PropertyGetOutput =
  { variant: "ok"; value: string }
  | { variant: "notfound"; message: string };

export interface PropertyDeleteInput {
  entity: string;
  key: string;
}

export type PropertyDeleteOutput =
  { variant: "ok"; entity: string }
  | { variant: "notfound"; message: string };

export interface PropertyDefineTypeInput {
  name: string;
  schema: string;
}

export type PropertyDefineTypeOutput =
  { variant: "ok"; name: string }
  | { variant: "exists"; message: string };

export interface PropertyListAllInput {
  entity: string;
}

export type PropertyListAllOutput =
  { variant: "ok"; properties: string };

