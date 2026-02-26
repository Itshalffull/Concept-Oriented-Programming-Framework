// generated: query.types.ts

export interface QueryParseInput {
  query: string;
  expression: string;
}

export type QueryParseOutput =
  { variant: "ok"; query: string }
  | { variant: "error"; message: string };

export interface QueryExecuteInput {
  query: string;
}

export type QueryExecuteOutput =
  { variant: "ok"; results: string }
  | { variant: "notfound"; query: string };

export interface QuerySubscribeInput {
  query: string;
}

export type QuerySubscribeOutput =
  { variant: "ok"; subscriptionId: string }
  | { variant: "notfound"; query: string };

export interface QueryAddFilterInput {
  query: string;
  filter: string;
}

export type QueryAddFilterOutput =
  { variant: "ok"; query: string }
  | { variant: "notfound"; query: string };

export interface QueryAddSortInput {
  query: string;
  sort: string;
}

export type QueryAddSortOutput =
  { variant: "ok"; query: string }
  | { variant: "notfound"; query: string };

export interface QuerySetScopeInput {
  query: string;
  scope: string;
}

export type QuerySetScopeOutput =
  { variant: "ok"; query: string }
  | { variant: "notfound"; query: string };

