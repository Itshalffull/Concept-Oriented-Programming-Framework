// generated: gcpsmprovider.handler.ts
import type { ConceptStorage } from "@clef/runtime";
import type * as T from "./gcpsmprovider.types";

export interface GcpSmProviderHandler {
  fetch(input: T.GcpSmProviderFetchInput, storage: ConceptStorage):
    Promise<T.GcpSmProviderFetchOutput>;
  rotate(input: T.GcpSmProviderRotateInput, storage: ConceptStorage):
    Promise<T.GcpSmProviderRotateOutput>;
}
