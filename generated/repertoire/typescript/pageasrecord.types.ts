// generated: pageasrecord.types.ts

export interface PageAsRecordCreateInput {
  page: string;
  schema: string;
}

export type PageAsRecordCreateOutput =
  { variant: "ok"; page: string }
  | { variant: "exists"; message: string };

export interface PageAsRecordSetPropertyInput {
  page: string;
  key: string;
  value: string;
}

export type PageAsRecordSetPropertyOutput =
  { variant: "ok"; page: string }
  | { variant: "notfound"; message: string }
  | { variant: "invalid"; message: string };

export interface PageAsRecordGetPropertyInput {
  page: string;
  key: string;
}

export type PageAsRecordGetPropertyOutput =
  { variant: "ok"; value: string }
  | { variant: "notfound"; message: string };

export interface PageAsRecordAppendToBodyInput {
  page: string;
  content: string;
}

export type PageAsRecordAppendToBodyOutput =
  { variant: "ok"; page: string }
  | { variant: "notfound"; message: string };

export interface PageAsRecordAttachToSchemaInput {
  page: string;
  schema: string;
}

export type PageAsRecordAttachToSchemaOutput =
  { variant: "ok"; page: string }
  | { variant: "notfound"; message: string };

export interface PageAsRecordConvertFromFreeformInput {
  page: string;
  schema: string;
}

export type PageAsRecordConvertFromFreeformOutput =
  { variant: "ok"; page: string }
  | { variant: "notfound"; message: string };

