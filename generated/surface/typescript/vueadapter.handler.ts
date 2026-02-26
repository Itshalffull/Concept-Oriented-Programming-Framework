// generated: vueadapter.handler.ts
import type { ConceptStorage } from "@clef/runtime";
import type * as T from "./vueadapter.types";

export interface VueAdapterHandler {
  normalize(input: T.VueAdapterNormalizeInput, storage: ConceptStorage):
    Promise<T.VueAdapterNormalizeOutput>;
}
