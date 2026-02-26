// generated: designtoken.handler.ts
import type { ConceptStorage } from "@clef/runtime";
import type * as T from "./designtoken.types";

export interface DesignTokenHandler {
  define(input: T.DesignTokenDefineInput, storage: ConceptStorage):
    Promise<T.DesignTokenDefineOutput>;
  alias(input: T.DesignTokenAliasInput, storage: ConceptStorage):
    Promise<T.DesignTokenAliasOutput>;
  resolve(input: T.DesignTokenResolveInput, storage: ConceptStorage):
    Promise<T.DesignTokenResolveOutput>;
  update(input: T.DesignTokenUpdateInput, storage: ConceptStorage):
    Promise<T.DesignTokenUpdateOutput>;
  remove(input: T.DesignTokenRemoveInput, storage: ConceptStorage):
    Promise<T.DesignTokenRemoveOutput>;
  export(input: T.DesignTokenExportInput, storage: ConceptStorage):
    Promise<T.DesignTokenExportOutput>;
}
