// generated: searchindex.types.ts

export interface SearchIndexCreateIndexInput {
  index: string;
  config: string;
}

export type SearchIndexCreateIndexOutput =
  { variant: "ok"; index: string }
  | { variant: "exists"; index: string };

export interface SearchIndexIndexItemInput {
  index: string;
  item: string;
  data: string;
}

export type SearchIndexIndexItemOutput =
  { variant: "ok"; index: string }
  | { variant: "notfound"; index: string };

export interface SearchIndexRemoveItemInput {
  index: string;
  item: string;
}

export type SearchIndexRemoveItemOutput =
  { variant: "ok"; index: string }
  | { variant: "notfound"; index: string };

export interface SearchIndexSearchInput {
  index: string;
  query: string;
}

export type SearchIndexSearchOutput =
  { variant: "ok"; results: string }
  | { variant: "notfound"; index: string };

export interface SearchIndexAddProcessorInput {
  index: string;
  processor: string;
}

export type SearchIndexAddProcessorOutput =
  { variant: "ok"; index: string }
  | { variant: "notfound"; index: string };

export interface SearchIndexReindexInput {
  index: string;
}

export type SearchIndexReindexOutput =
  { variant: "ok"; count: number }
  | { variant: "notfound"; index: string };

