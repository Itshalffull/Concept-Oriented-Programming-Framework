// generated: compensationplan.handler.ts
import type { ConceptStorage } from "@clef/runtime";
import type * as T from "./compensationplan.types";

export interface CompensationPlanHandler {
  register(input: T.CompensationPlanRegisterInput, storage: ConceptStorage):
    Promise<T.CompensationPlanRegisterOutput>;
  trigger(input: T.CompensationPlanTriggerInput, storage: ConceptStorage):
    Promise<T.CompensationPlanTriggerOutput>;
  executeNext(input: T.CompensationPlanExecuteNextInput, storage: ConceptStorage):
    Promise<T.CompensationPlanExecuteNextOutput>;
  markCompensationFailed(input: T.CompensationPlanMarkCompensationFailedInput, storage: ConceptStorage):
    Promise<T.CompensationPlanMarkCompensationFailedOutput>;
}
