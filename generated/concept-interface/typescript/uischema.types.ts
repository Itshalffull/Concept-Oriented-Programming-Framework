// generated: uischema.types.ts

export interface UISchemaInspectInput {
  schema: string;
  conceptSpec: string;
}

export type UISchemaInspectOutput =
  { variant: "ok"; schema: string }
  | { variant: "parseError"; message: string };

export interface UISchemaOverrideInput {
  schema: string;
  overrides: string;
}

export type UISchemaOverrideOutput =
  { variant: "ok"; schema: string }
  | { variant: "notfound"; message: string }
  | { variant: "invalid"; message: string };

export interface UISchemaGetSchemaInput {
  schema: string;
}

export type UISchemaGetSchemaOutput =
  { variant: "ok"; schema: string; uiSchema: string }
  | { variant: "notfound"; message: string };

export interface UISchemaGetElementsInput {
  schema: string;
}

export type UISchemaGetElementsOutput =
  { variant: "ok"; elements: string }
  | { variant: "notfound"; message: string };

