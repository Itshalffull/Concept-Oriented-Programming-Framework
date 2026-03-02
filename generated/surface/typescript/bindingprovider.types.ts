// generated: bindingprovider.types.ts

export interface BindingProviderInitializeInput {
  config: Record<string, unknown>;
}

export type BindingProviderInitializeOutput =
  { variant: "ok"; provider: string; pluginRef: string }
  | { variant: "configError"; message: string };

export interface BindingProviderBindInput {
  bindingId: string;
  source: string;
  target: string;
  direction: "oneWay" | "twoWay";
}

export type BindingProviderBindOutput =
  { variant: "ok"; bindingId: string }
  | { variant: "duplicate"; message: string }
  | { variant: "invalid"; message: string };

export interface BindingProviderSyncInput {
  bindingId: string;
}

export type BindingProviderSyncOutput =
  { variant: "ok"; bindingId: string; synced: boolean }
  | { variant: "notfound"; message: string };

export interface BindingProviderInvokeInput {
  bindingId: string;
  value: unknown;
}

export type BindingProviderInvokeOutput =
  { variant: "ok"; bindingId: string; propagated: boolean }
  | { variant: "notfound"; message: string };

export interface BindingProviderUnbindInput {
  bindingId: string;
}

export type BindingProviderUnbindOutput =
  { variant: "ok"; bindingId: string }
  | { variant: "notfound"; message: string };
