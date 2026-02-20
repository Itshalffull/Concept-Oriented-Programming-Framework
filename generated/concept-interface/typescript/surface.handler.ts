// generated: surface.handler.ts
import type { ConceptStorage } from "@copf/runtime";
import type * as T from "./surface.types";

export interface SurfaceHandler {
  create(input: T.SurfaceCreateInput, storage: ConceptStorage):
    Promise<T.SurfaceCreateOutput>;
  attach(input: T.SurfaceAttachInput, storage: ConceptStorage):
    Promise<T.SurfaceAttachOutput>;
  resize(input: T.SurfaceResizeInput, storage: ConceptStorage):
    Promise<T.SurfaceResizeOutput>;
  destroy(input: T.SurfaceDestroyInput, storage: ConceptStorage):
    Promise<T.SurfaceDestroyOutput>;
}
