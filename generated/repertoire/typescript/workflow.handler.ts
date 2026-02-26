// generated: workflow.handler.ts
import type { ConceptStorage } from "@clef/runtime";
import type * as T from "./workflow.types";

export interface WorkflowHandler {
  defineState(input: T.WorkflowDefineStateInput, storage: ConceptStorage):
    Promise<T.WorkflowDefineStateOutput>;
  defineTransition(input: T.WorkflowDefineTransitionInput, storage: ConceptStorage):
    Promise<T.WorkflowDefineTransitionOutput>;
  transition(input: T.WorkflowTransitionInput, storage: ConceptStorage):
    Promise<T.WorkflowTransitionOutput>;
  getCurrentState(input: T.WorkflowGetCurrentStateInput, storage: ConceptStorage):
    Promise<T.WorkflowGetCurrentStateOutput>;
}
