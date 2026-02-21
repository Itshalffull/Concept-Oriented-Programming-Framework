// generated: dotenvprovider.handler.ts
import type { ConceptStorage } from "@copf/runtime";
import type * as T from "./dotenvprovider.types";

export interface DotenvProviderHandler {
  fetch(input: T.DotenvProviderFetchInput, storage: ConceptStorage):
    Promise<T.DotenvProviderFetchOutput>;
}
