// generated: gtkadapter.handler.ts
import type { ConceptStorage } from "@copf/runtime";
import type * as T from "./gtkadapter.types";

export interface GTKAdapterHandler {
  normalize(input: T.GTKAdapterNormalizeInput, storage: ConceptStorage):
    Promise<T.GTKAdapterNormalizeOutput>;
}
