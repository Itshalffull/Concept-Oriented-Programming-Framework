// generated: watchkitadapter.types.ts

export interface WatchKitAdapterNormalizeInput {
  adapter: string;
  props: string;
}

export type WatchKitAdapterNormalizeOutput =
  { variant: "ok"; adapter: string; normalized: string }
  | { variant: "error"; message: string };

