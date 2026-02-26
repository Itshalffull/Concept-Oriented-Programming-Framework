// generated: env.handler.ts
import type { ConceptStorage } from "@clef/runtime";
import type * as T from "./env.types";

export interface EnvHandler {
  resolve(input: T.EnvResolveInput, storage: ConceptStorage):
    Promise<T.EnvResolveOutput>;
  promote(input: T.EnvPromoteInput, storage: ConceptStorage):
    Promise<T.EnvPromoteOutput>;
  diff(input: T.EnvDiffInput, storage: ConceptStorage):
    Promise<T.EnvDiffOutput>;
}
