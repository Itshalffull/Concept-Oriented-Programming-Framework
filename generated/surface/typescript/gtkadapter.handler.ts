// generated: gtkadapter.handler.ts
import type { ConceptStorage } from "@clef/runtime";
import type * as T from "./gtkadapter.types";

export interface GTKAdapterHandler {
  normalize(input: T.GTKAdapterNormalizeInput, storage: ConceptStorage):
    Promise<T.GTKAdapterNormalizeOutput>;
}
