// generated: watchkitadapter.handler.ts
import type { ConceptStorage } from "@clef/runtime";
import type * as T from "./watchkitadapter.types";

export interface WatchKitAdapterHandler {
  normalize(input: T.WatchKitAdapterNormalizeInput, storage: ConceptStorage):
    Promise<T.WatchKitAdapterNormalizeOutput>;
}
