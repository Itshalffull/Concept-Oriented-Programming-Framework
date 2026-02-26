// generated: nativescriptadapter.types.ts

export interface NativeScriptAdapterNormalizeInput {
  adapter: string;
  props: string;
}

export type NativeScriptAdapterNormalizeOutput =
  { variant: "ok"; adapter: string; normalized: string }
  | { variant: "error"; message: string };

