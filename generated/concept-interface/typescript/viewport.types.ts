// generated: viewport.types.ts

export interface ViewportObserveInput {
  viewport: string;
  width: number;
  height: number;
}

export type ViewportObserveOutput =
  { variant: "ok"; viewport: string; breakpoint: string; orientation: string };

export interface ViewportSetBreakpointsInput {
  viewport: string;
  breakpoints: string;
}

export type ViewportSetBreakpointsOutput =
  { variant: "ok"; viewport: string }
  | { variant: "invalid"; message: string };

export interface ViewportGetBreakpointInput {
  viewport: string;
}

export type ViewportGetBreakpointOutput =
  { variant: "ok"; viewport: string; breakpoint: string; width: number; height: number }
  | { variant: "notfound"; message: string };

