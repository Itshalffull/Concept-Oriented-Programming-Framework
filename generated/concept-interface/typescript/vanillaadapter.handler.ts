// generated: vanillaadapter.handler.ts
import type { ConceptStorage } from "@copf/runtime";
import type * as T from "./vanillaadapter.types";

export interface VanillaAdapterHandler {
  normalize(input: T.VanillaAdapterNormalizeInput, storage: ConceptStorage):
    Promise<T.VanillaAdapterNormalizeOutput>;
}
