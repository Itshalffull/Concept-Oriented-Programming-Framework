// generated: flowtoken.handler.ts
import type { ConceptStorage } from "@clef/runtime";
import type * as T from "./flowtoken.types";

export interface FlowTokenHandler {
  emit(input: T.FlowTokenEmitInput, storage: ConceptStorage):
    Promise<T.FlowTokenEmitOutput>;
  consume(input: T.FlowTokenConsumeInput, storage: ConceptStorage):
    Promise<T.FlowTokenConsumeOutput>;
  kill(input: T.FlowTokenKillInput, storage: ConceptStorage):
    Promise<T.FlowTokenKillOutput>;
  countActive(input: T.FlowTokenCountActiveInput, storage: ConceptStorage):
    Promise<T.FlowTokenCountActiveOutput>;
  listActive(input: T.FlowTokenListActiveInput, storage: ConceptStorage):
    Promise<T.FlowTokenListActiveOutput>;
}
