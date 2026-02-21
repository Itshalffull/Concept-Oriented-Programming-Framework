// generated: canvas.types.ts

export interface CanvasAddNodeInput {
  canvas: string;
  node: string;
  x: number;
  y: number;
}

export type CanvasAddNodeOutput =
  { variant: "ok" }
  | { variant: "notfound"; message: string };

export interface CanvasMoveNodeInput {
  canvas: string;
  node: string;
  x: number;
  y: number;
}

export type CanvasMoveNodeOutput =
  { variant: "ok" }
  | { variant: "notfound"; message: string };

export interface CanvasConnectNodesInput {
  canvas: string;
  from: string;
  to: string;
}

export type CanvasConnectNodesOutput =
  { variant: "ok" }
  | { variant: "notfound"; message: string };

export interface CanvasGroupNodesInput {
  canvas: string;
  nodes: string;
  group: string;
}

export type CanvasGroupNodesOutput =
  { variant: "ok" }
  | { variant: "notfound"; message: string };

export interface CanvasEmbedFileInput {
  canvas: string;
  node: string;
  file: string;
}

export type CanvasEmbedFileOutput =
  { variant: "ok" }
  | { variant: "notfound"; message: string };

