// generated: reactadapter.handler.ts
import type { ConceptStorage } from "@clef/runtime";
import type * as T from "./reactadapter.types";

export interface ReactAdapterHandler {
  normalize(input: T.ReactAdapterNormalizeInput, storage: ConceptStorage):
    Promise<T.ReactAdapterNormalizeOutput>;
}
