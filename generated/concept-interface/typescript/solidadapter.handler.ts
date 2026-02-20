// generated: solidadapter.handler.ts
import type { ConceptStorage } from "@copf/runtime";
import type * as T from "./solidadapter.types";

export interface SolidAdapterHandler {
  normalize(input: T.SolidAdapterNormalizeInput, storage: ConceptStorage):
    Promise<T.SolidAdapterNormalizeOutput>;
}
