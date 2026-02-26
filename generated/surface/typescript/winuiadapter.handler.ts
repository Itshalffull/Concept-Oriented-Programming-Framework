// generated: winuiadapter.handler.ts
import type { ConceptStorage } from "@clef/runtime";
import type * as T from "./winuiadapter.types";

export interface WinUIAdapterHandler {
  normalize(input: T.WinUIAdapterNormalizeInput, storage: ConceptStorage):
    Promise<T.WinUIAdapterNormalizeOutput>;
}
