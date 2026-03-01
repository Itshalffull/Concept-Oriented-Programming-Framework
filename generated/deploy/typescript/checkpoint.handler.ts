// generated: checkpoint.handler.ts
import type { ConceptStorage } from "@clef/runtime";
import type * as T from "./checkpoint.types";

export interface CheckpointHandler {
  capture(input: T.CheckpointCaptureInput, storage: ConceptStorage):
    Promise<T.CheckpointCaptureOutput>;
  restore(input: T.CheckpointRestoreInput, storage: ConceptStorage):
    Promise<T.CheckpointRestoreOutput>;
  findLatest(input: T.CheckpointFindLatestInput, storage: ConceptStorage):
    Promise<T.CheckpointFindLatestOutput>;
  prune(input: T.CheckpointPruneInput, storage: ConceptStorage):
    Promise<T.CheckpointPruneOutput>;
}
