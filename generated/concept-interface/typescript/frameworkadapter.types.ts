// generated: frameworkadapter.types.ts

export interface FrameworkAdapterRegisterInput {
  renderer: string;
  framework: string;
  version: string;
  normalizer: string;
  mountFn: string;
}

export type FrameworkAdapterRegisterOutput =
  { variant: "ok"; renderer: string }
  | { variant: "duplicate"; message: string };

export interface FrameworkAdapterNormalizeInput {
  renderer: string;
  props: string;
}

export type FrameworkAdapterNormalizeOutput =
  { variant: "ok"; normalized: string }
  | { variant: "notfound"; message: string };

export interface FrameworkAdapterMountInput {
  renderer: string;
  machine: string;
  target: string;
}

export type FrameworkAdapterMountOutput =
  { variant: "ok"; renderer: string }
  | { variant: "error"; message: string };

export interface FrameworkAdapterUnmountInput {
  renderer: string;
  target: string;
}

export type FrameworkAdapterUnmountOutput =
  { variant: "ok"; renderer: string }
  | { variant: "notfound"; message: string };

