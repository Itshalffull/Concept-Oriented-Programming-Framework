// generated: artifact.handler.ts
import type { ConceptStorage } from "@copf/runtime";
import type * as T from "./artifact.types";

export interface ArtifactHandler {
  build(input: T.ArtifactBuildInput, storage: ConceptStorage):
    Promise<T.ArtifactBuildOutput>;
  resolve(input: T.ArtifactResolveInput, storage: ConceptStorage):
    Promise<T.ArtifactResolveOutput>;
  gc(input: T.ArtifactGcInput, storage: ConceptStorage):
    Promise<T.ArtifactGcOutput>;
}
