// generated: appkitadapter.types.ts

export interface AppKitAdapterNormalizeInput {
  adapter: string;
  props: string;
}

export type AppKitAdapterNormalizeOutput =
  { variant: "ok"; adapter: string; normalized: string }
  | { variant: "error"; message: string };

