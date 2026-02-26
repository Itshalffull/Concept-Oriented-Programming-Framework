// generated: signal.handler.ts
import type { ConceptStorage } from "@clef/runtime";
import type * as T from "./signal.types";

export interface SignalHandler {
  create(input: T.SignalCreateInput, storage: ConceptStorage):
    Promise<T.SignalCreateOutput>;
  read(input: T.SignalReadInput, storage: ConceptStorage):
    Promise<T.SignalReadOutput>;
  write(input: T.SignalWriteInput, storage: ConceptStorage):
    Promise<T.SignalWriteOutput>;
  batch(input: T.SignalBatchInput, storage: ConceptStorage):
    Promise<T.SignalBatchOutput>;
  dispose(input: T.SignalDisposeInput, storage: ConceptStorage):
    Promise<T.SignalDisposeOutput>;
}
