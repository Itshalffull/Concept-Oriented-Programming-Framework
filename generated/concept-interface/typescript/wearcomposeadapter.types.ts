// generated: wearcomposeadapter.types.ts

export interface WearComposeAdapterNormalizeInput {
  adapter: string;
  props: string;
}

export type WearComposeAdapterNormalizeOutput =
  { variant: "ok"; adapter: string; normalized: string }
  | { variant: "error"; message: string };

