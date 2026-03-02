// generated: viewportprovider.types.ts

export interface ViewportProviderInitializeInput {
  config: Record<string, unknown>;
}

export type ViewportProviderInitializeOutput =
  { variant: "ok"; provider: string; pluginRef: string }
  | { variant: "configError"; message: string };

export interface ViewportProviderObserveInput {
  target: string;
}

export type ViewportProviderObserveOutput =
  { variant: "ok"; target: string; width: number; height: number; breakpoint: string }
  | { variant: "notfound"; message: string };

export interface ViewportProviderGetBreakpointInput {
  width: number;
}

export type ViewportProviderGetBreakpointOutput =
  { variant: "ok"; breakpoint: string; minWidth: number; maxWidth: number | null };

export interface ViewportProviderSetBreakpointsInput {
  breakpoints: Array<{ name: string; minWidth: number; maxWidth: number | null }>;
}

export type ViewportProviderSetBreakpointsOutput =
  { variant: "ok"; count: number }
  | { variant: "invalid"; message: string };
