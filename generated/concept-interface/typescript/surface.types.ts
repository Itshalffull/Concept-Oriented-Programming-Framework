// generated: surface.types.ts

export interface SurfaceCreateInput {
  surface: string;
  kind: string;
  mountPoint: string | null;
}

export type SurfaceCreateOutput =
  { variant: "ok"; surface: string }
  | { variant: "unsupported"; message: string };

export interface SurfaceAttachInput {
  surface: string;
  renderer: string;
}

export type SurfaceAttachOutput =
  { variant: "ok"; surface: string }
  | { variant: "incompatible"; message: string };

export interface SurfaceResizeInput {
  surface: string;
  width: number;
  height: number;
}

export type SurfaceResizeOutput =
  { variant: "ok"; surface: string }
  | { variant: "notfound"; message: string };

export interface SurfaceDestroyInput {
  surface: string;
}

export type SurfaceDestroyOutput =
  { variant: "ok"; surface: string }
  | { variant: "notfound"; message: string };

