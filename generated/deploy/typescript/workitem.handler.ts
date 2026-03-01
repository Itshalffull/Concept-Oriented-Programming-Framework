// generated: workitem.handler.ts
import type { ConceptStorage } from "@clef/runtime";
import type * as T from "./workitem.types";

export interface WorkItemHandler {
  create(input: T.WorkItemCreateInput, storage: ConceptStorage):
    Promise<T.WorkItemCreateOutput>;
  claim(input: T.WorkItemClaimInput, storage: ConceptStorage):
    Promise<T.WorkItemClaimOutput>;
  start(input: T.WorkItemStartInput, storage: ConceptStorage):
    Promise<T.WorkItemStartOutput>;
  complete(input: T.WorkItemCompleteInput, storage: ConceptStorage):
    Promise<T.WorkItemCompleteOutput>;
  reject(input: T.WorkItemRejectInput, storage: ConceptStorage):
    Promise<T.WorkItemRejectOutput>;
  delegate(input: T.WorkItemDelegateInput, storage: ConceptStorage):
    Promise<T.WorkItemDelegateOutput>;
  release(input: T.WorkItemReleaseInput, storage: ConceptStorage):
    Promise<T.WorkItemReleaseOutput>;
}
