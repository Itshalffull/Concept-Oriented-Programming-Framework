// generated: gtkadapter.types.ts

export interface GTKAdapterNormalizeInput {
  adapter: string;
  props: string;
}

export type GTKAdapterNormalizeOutput =
  { variant: "ok"; adapter: string; normalized: string }
  | { variant: "error"; message: string };

