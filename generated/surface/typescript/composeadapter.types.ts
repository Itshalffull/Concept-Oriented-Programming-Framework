// generated: composeadapter.types.ts

export interface ComposeAdapterNormalizeInput {
  adapter: string;
  props: string;
}

export type ComposeAdapterNormalizeOutput =
  { variant: "ok"; adapter: string; normalized: string }
  | { variant: "error"; message: string };

