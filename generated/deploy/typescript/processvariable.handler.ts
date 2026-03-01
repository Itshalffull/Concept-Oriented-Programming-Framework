// generated: processvariable.handler.ts
import type { ConceptStorage } from "@clef/runtime";
import type * as T from "./processvariable.types";

export interface ProcessVariableHandler {
  set(input: T.ProcessVariableSetInput, storage: ConceptStorage):
    Promise<T.ProcessVariableSetOutput>;
  get(input: T.ProcessVariableGetInput, storage: ConceptStorage):
    Promise<T.ProcessVariableGetOutput>;
  merge(input: T.ProcessVariableMergeInput, storage: ConceptStorage):
    Promise<T.ProcessVariableMergeOutput>;
  delete(input: T.ProcessVariableDeleteInput, storage: ConceptStorage):
    Promise<T.ProcessVariableDeleteOutput>;
  list(input: T.ProcessVariableListInput, storage: ConceptStorage):
    Promise<T.ProcessVariableListOutput>;
  snapshot(input: T.ProcessVariableSnapshotInput, storage: ConceptStorage):
    Promise<T.ProcessVariableSnapshotOutput>;
}
