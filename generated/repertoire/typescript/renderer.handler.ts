// generated: renderer.handler.ts
import type { ConceptStorage } from "@clef/runtime";
import type * as T from "./renderer.types";

export interface RendererHandler {
  render(input: T.RendererRenderInput, storage: ConceptStorage):
    Promise<T.RendererRenderOutput>;
  autoPlaceholder(input: T.RendererAutoPlaceholderInput, storage: ConceptStorage):
    Promise<T.RendererAutoPlaceholderOutput>;
  stream(input: T.RendererStreamInput, storage: ConceptStorage):
    Promise<T.RendererStreamOutput>;
  mergeCacheability(input: T.RendererMergeCacheabilityInput, storage: ConceptStorage):
    Promise<T.RendererMergeCacheabilityOutput>;
}
