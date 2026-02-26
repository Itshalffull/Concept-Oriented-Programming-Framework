// generated: inkadapter.types.ts

export interface InkAdapterNormalizeInput {
  adapter: string;
  props: string;
}

export type InkAdapterNormalizeOutput =
  { variant: "ok"; adapter: string; normalized: string }
  | { variant: "error"; message: string };

