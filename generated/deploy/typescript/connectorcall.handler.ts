// generated: connectorcall.handler.ts
import type { ConceptStorage } from "@clef/runtime";
import type * as T from "./connectorcall.types";

export interface ConnectorCallHandler {
  invoke(input: T.ConnectorCallInvokeInput, storage: ConceptStorage):
    Promise<T.ConnectorCallInvokeOutput>;
  markSuccess(input: T.ConnectorCallMarkSuccessInput, storage: ConceptStorage):
    Promise<T.ConnectorCallMarkSuccessOutput>;
  markFailure(input: T.ConnectorCallMarkFailureInput, storage: ConceptStorage):
    Promise<T.ConnectorCallMarkFailureOutput>;
  getResult(input: T.ConnectorCallGetResultInput, storage: ConceptStorage):
    Promise<T.ConnectorCallGetResultOutput>;
}
