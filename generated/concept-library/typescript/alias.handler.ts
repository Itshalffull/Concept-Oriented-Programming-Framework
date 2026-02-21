// generated: alias.handler.ts
import type { ConceptStorage } from "@copf/runtime";
import type * as T from "./alias.types";

export interface AliasHandler {
  addAlias(input: T.AliasAddAliasInput, storage: ConceptStorage):
    Promise<T.AliasAddAliasOutput>;
  removeAlias(input: T.AliasRemoveAliasInput, storage: ConceptStorage):
    Promise<T.AliasRemoveAliasOutput>;
  resolve(input: T.AliasResolveInput, storage: ConceptStorage):
    Promise<T.AliasResolveOutput>;
}
