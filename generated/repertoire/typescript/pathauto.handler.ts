// generated: pathauto.handler.ts
import type { ConceptStorage } from "@clef/runtime";
import type * as T from "./pathauto.types";

export interface PathautoHandler {
  generateAlias(input: T.PathautoGenerateAliasInput, storage: ConceptStorage):
    Promise<T.PathautoGenerateAliasOutput>;
  bulkGenerate(input: T.PathautoBulkGenerateInput, storage: ConceptStorage):
    Promise<T.PathautoBulkGenerateOutput>;
  cleanString(input: T.PathautoCleanStringInput, storage: ConceptStorage):
    Promise<T.PathautoCleanStringOutput>;
}
