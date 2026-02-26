// generated: contentstorage.types.ts

export interface ContentStorageSaveInput {
  record: string;
  data: string;
}

export type ContentStorageSaveOutput =
  { variant: "ok"; record: string }
  | { variant: "error"; message: string };

export interface ContentStorageLoadInput {
  record: string;
}

export type ContentStorageLoadOutput =
  { variant: "ok"; record: string; data: string }
  | { variant: "notfound"; message: string };

export interface ContentStorageDeleteInput {
  record: string;
}

export type ContentStorageDeleteOutput =
  { variant: "ok"; record: string }
  | { variant: "notfound"; message: string };

export interface ContentStorageQueryInput {
  filter: string;
}

export type ContentStorageQueryOutput =
  { variant: "ok"; results: string };

export interface ContentStorageGenerateSchemaInput {
  record: string;
}

export type ContentStorageGenerateSchemaOutput =
  { variant: "ok"; schema: string }
  | { variant: "notfound"; message: string };

