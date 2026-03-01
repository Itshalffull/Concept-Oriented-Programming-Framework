// generated: processrun.handler.ts
import type { ConceptStorage } from "@clef/runtime";
import type * as T from "./processrun.types";

export interface ProcessRunHandler {
  start(input: T.ProcessRunStartInput, storage: ConceptStorage):
    Promise<T.ProcessRunStartOutput>;
  startChild(input: T.ProcessRunStartChildInput, storage: ConceptStorage):
    Promise<T.ProcessRunStartChildOutput>;
  complete(input: T.ProcessRunCompleteInput, storage: ConceptStorage):
    Promise<T.ProcessRunCompleteOutput>;
  fail(input: T.ProcessRunFailInput, storage: ConceptStorage):
    Promise<T.ProcessRunFailOutput>;
  cancel(input: T.ProcessRunCancelInput, storage: ConceptStorage):
    Promise<T.ProcessRunCancelOutput>;
  suspend(input: T.ProcessRunSuspendInput, storage: ConceptStorage):
    Promise<T.ProcessRunSuspendOutput>;
  resume(input: T.ProcessRunResumeInput, storage: ConceptStorage):
    Promise<T.ProcessRunResumeOutput>;
  getStatus(input: T.ProcessRunGetStatusInput, storage: ConceptStorage):
    Promise<T.ProcessRunGetStatusOutput>;
}
