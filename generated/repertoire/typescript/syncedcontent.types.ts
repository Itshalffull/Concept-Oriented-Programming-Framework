// generated: syncedcontent.types.ts

export interface SyncedContentCreateReferenceInput {
  ref: string;
  original: string;
}

export type SyncedContentCreateReferenceOutput =
  { variant: "ok" }
  | { variant: "notfound"; message: string };

export interface SyncedContentEditOriginalInput {
  original: string;
  content: string;
}

export type SyncedContentEditOriginalOutput =
  { variant: "ok" }
  | { variant: "notfound"; message: string };

export interface SyncedContentDeleteReferenceInput {
  ref: string;
}

export type SyncedContentDeleteReferenceOutput =
  { variant: "ok" }
  | { variant: "notfound"; message: string };

export interface SyncedContentConvertToIndependentInput {
  ref: string;
}

export type SyncedContentConvertToIndependentOutput =
  { variant: "ok" }
  | { variant: "notfound"; message: string };

