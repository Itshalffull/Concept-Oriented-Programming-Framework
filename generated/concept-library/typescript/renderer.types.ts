// generated: renderer.types.ts

export interface RendererRenderInput {
  renderer: string;
  tree: string;
}

export type RendererRenderOutput =
  { variant: "ok"; output: string }
  | { variant: "error"; message: string };

export interface RendererAutoPlaceholderInput {
  renderer: string;
  name: string;
}

export type RendererAutoPlaceholderOutput =
  { variant: "ok"; placeholder: string };

export interface RendererStreamInput {
  renderer: string;
  tree: string;
}

export type RendererStreamOutput =
  { variant: "ok"; streamId: string }
  | { variant: "error"; message: string };

export interface RendererMergeCacheabilityInput {
  renderer: string;
  tags: string;
}

export type RendererMergeCacheabilityOutput =
  { variant: "ok"; merged: string };

