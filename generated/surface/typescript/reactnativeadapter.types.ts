// generated: reactnativeadapter.types.ts

export interface ReactNativeAdapterNormalizeInput {
  adapter: string;
  props: string;
}

export type ReactNativeAdapterNormalizeOutput =
  { variant: "ok"; adapter: string; normalized: string }
  | { variant: "error"; message: string };

