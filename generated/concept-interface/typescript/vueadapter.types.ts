// generated: vueadapter.types.ts

export interface VueAdapterNormalizeInput {
  adapter: string;
  props: string;
}

export type VueAdapterNormalizeOutput =
  { variant: "ok"; adapter: string; normalized: string }
  | { variant: "error"; message: string };

