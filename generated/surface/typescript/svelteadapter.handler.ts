// generated: svelteadapter.handler.ts
import type { ConceptStorage } from "@clef/runtime";
import type * as T from "./svelteadapter.types";

export interface SvelteAdapterHandler {
  normalize(input: T.SvelteAdapterNormalizeInput, storage: ConceptStorage):
    Promise<T.SvelteAdapterNormalizeOutput>;
}
