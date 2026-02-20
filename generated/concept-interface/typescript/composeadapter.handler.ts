// generated: composeadapter.handler.ts
import type { ConceptStorage } from "@copf/runtime";
import type * as T from "./composeadapter.types";

export interface ComposeAdapterHandler {
  normalize(input: T.ComposeAdapterNormalizeInput, storage: ConceptStorage):
    Promise<T.ComposeAdapterNormalizeOutput>;
}
