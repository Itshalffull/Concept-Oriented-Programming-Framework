// generated: vanillaadapter.types.ts

export interface VanillaAdapterNormalizeInput {
  adapter: string;
  props: string;
}

export type VanillaAdapterNormalizeOutput =
  { variant: "ok"; adapter: string; normalized: string }
  | { variant: "error"; message: string };

