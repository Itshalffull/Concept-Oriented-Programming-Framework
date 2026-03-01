// generated: llmcall.handler.ts
import type { ConceptStorage } from "@clef/runtime";
import type * as T from "./llmcall.types";

export interface LlmCallHandler {
  request(input: T.LlmCallRequestInput, storage: ConceptStorage):
    Promise<T.LlmCallRequestOutput>;
  recordResponse(input: T.LlmCallRecordResponseInput, storage: ConceptStorage):
    Promise<T.LlmCallRecordResponseOutput>;
  validate(input: T.LlmCallValidateInput, storage: ConceptStorage):
    Promise<T.LlmCallValidateOutput>;
  repair(input: T.LlmCallRepairInput, storage: ConceptStorage):
    Promise<T.LlmCallRepairOutput>;
  accept(input: T.LlmCallAcceptInput, storage: ConceptStorage):
    Promise<T.LlmCallAcceptOutput>;
  reject(input: T.LlmCallRejectInput, storage: ConceptStorage):
    Promise<T.LlmCallRejectOutput>;
}
