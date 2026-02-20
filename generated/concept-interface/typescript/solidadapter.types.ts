// generated: solidadapter.types.ts

export interface SolidAdapterNormalizeInput {
  adapter: string;
  props: string;
}

export type SolidAdapterNormalizeOutput =
  { variant: "ok"; adapter: string; normalized: string }
  | { variant: "error"; message: string };

