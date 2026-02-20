// generated: inkadapter.handler.ts
import type { ConceptStorage } from "@copf/runtime";
import type * as T from "./inkadapter.types";

export interface InkAdapterHandler {
  normalize(input: T.InkAdapterNormalizeInput, storage: ConceptStorage):
    Promise<T.InkAdapterNormalizeOutput>;
}
