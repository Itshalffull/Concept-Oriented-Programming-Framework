// generated: schema.types.ts

export interface SchemaDefineSchemaInput {
  schema: string;
  fields: string;
}

export type SchemaDefineSchemaOutput =
  { variant: "ok" }
  | { variant: "exists"; message: string };

export interface SchemaAddFieldInput {
  schema: string;
  field: string;
}

export type SchemaAddFieldOutput =
  { variant: "ok" }
  | { variant: "notfound"; message: string };

export interface SchemaExtendSchemaInput {
  schema: string;
  parent: string;
}

export type SchemaExtendSchemaOutput =
  { variant: "ok" }
  | { variant: "notfound"; message: string };

export interface SchemaApplyToInput {
  entity: string;
  schema: string;
}

export type SchemaApplyToOutput =
  { variant: "ok" }
  | { variant: "notfound"; message: string };

export interface SchemaRemoveFromInput {
  entity: string;
  schema: string;
}

export type SchemaRemoveFromOutput =
  { variant: "ok" }
  | { variant: "notfound"; message: string };

export interface SchemaGetAssociationsInput {
  schema: string;
}

export type SchemaGetAssociationsOutput =
  { variant: "ok"; associations: string }
  | { variant: "notfound"; message: string };

export interface SchemaExportInput {
  schema: string;
}

export type SchemaExportOutput =
  { variant: "ok"; data: string }
  | { variant: "notfound"; message: string };

