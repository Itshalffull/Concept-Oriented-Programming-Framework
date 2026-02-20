// generated: svelteadapter.types.ts

export interface SvelteAdapterNormalizeInput {
  adapter: string;
  props: string;
}

export type SvelteAdapterNormalizeOutput =
  { variant: "ok"; adapter: string; normalized: string }
  | { variant: "error"; message: string };

