// generated: wearcomposeadapter.handler.ts
import type { ConceptStorage } from "@copf/runtime";
import type * as T from "./wearcomposeadapter.types";

export interface WearComposeAdapterHandler {
  normalize(input: T.WearComposeAdapterNormalizeInput, storage: ConceptStorage):
    Promise<T.WearComposeAdapterNormalizeOutput>;
}
