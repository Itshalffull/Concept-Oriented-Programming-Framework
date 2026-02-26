// generated: envprovider.handler.ts
import type { ConceptStorage } from "@clef/runtime";
import type * as T from "./envprovider.types";

export interface EnvProviderHandler {
  fetch(input: T.EnvProviderFetchInput, storage: ConceptStorage):
    Promise<T.EnvProviderFetchOutput>;
}
