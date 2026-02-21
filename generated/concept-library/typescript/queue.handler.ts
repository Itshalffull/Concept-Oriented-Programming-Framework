// generated: queue.handler.ts
import type { ConceptStorage } from "@copf/runtime";
import type * as T from "./queue.types";

export interface QueueHandler {
  enqueue(input: T.QueueEnqueueInput, storage: ConceptStorage):
    Promise<T.QueueEnqueueOutput>;
  claim(input: T.QueueClaimInput, storage: ConceptStorage):
    Promise<T.QueueClaimOutput>;
  process(input: T.QueueProcessInput, storage: ConceptStorage):
    Promise<T.QueueProcessOutput>;
  release(input: T.QueueReleaseInput, storage: ConceptStorage):
    Promise<T.QueueReleaseOutput>;
  delete(input: T.QueueDeleteInput, storage: ConceptStorage):
    Promise<T.QueueDeleteOutput>;
}
