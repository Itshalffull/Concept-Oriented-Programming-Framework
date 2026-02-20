// generated: reactadapter.types.ts

export interface ReactAdapterNormalizeInput {
  adapter: string;
  props: string;
}

export type ReactAdapterNormalizeOutput =
  { variant: "ok"; adapter: string; normalized: string }
  | { variant: "error"; message: string };

