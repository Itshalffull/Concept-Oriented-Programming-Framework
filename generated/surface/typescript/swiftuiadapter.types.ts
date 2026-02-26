// generated: swiftuiadapter.types.ts

export interface SwiftUIAdapterNormalizeInput {
  adapter: string;
  props: string;
}

export type SwiftUIAdapterNormalizeOutput =
  { variant: "ok"; adapter: string; normalized: string }
  | { variant: "error"; message: string };

