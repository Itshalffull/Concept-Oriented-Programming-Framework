// generated: winuiadapter.types.ts

export interface WinUIAdapterNormalizeInput {
  adapter: string;
  props: string;
}

export type WinUIAdapterNormalizeOutput =
  { variant: "ok"; adapter: string; normalized: string }
  | { variant: "error"; message: string };

