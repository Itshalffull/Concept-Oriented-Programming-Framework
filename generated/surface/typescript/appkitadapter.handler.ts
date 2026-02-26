// generated: appkitadapter.handler.ts
import type { ConceptStorage } from "@clef/runtime";
import type * as T from "./appkitadapter.types";

export interface AppKitAdapterHandler {
  normalize(input: T.AppKitAdapterNormalizeInput, storage: ConceptStorage):
    Promise<T.AppKitAdapterNormalizeOutput>;
}
