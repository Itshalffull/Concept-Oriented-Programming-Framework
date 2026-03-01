// generated: steprun.handler.ts
import type { ConceptStorage } from "@clef/runtime";
import type * as T from "./steprun.types";

export interface StepRunHandler {
  start(input: T.StepRunStartInput, storage: ConceptStorage):
    Promise<T.StepRunStartOutput>;
  complete(input: T.StepRunCompleteInput, storage: ConceptStorage):
    Promise<T.StepRunCompleteOutput>;
  fail(input: T.StepRunFailInput, storage: ConceptStorage):
    Promise<T.StepRunFailOutput>;
  cancel(input: T.StepRunCancelInput, storage: ConceptStorage):
    Promise<T.StepRunCancelOutput>;
  skip(input: T.StepRunSkipInput, storage: ConceptStorage):
    Promise<T.StepRunSkipOutput>;
  get(input: T.StepRunGetInput, storage: ConceptStorage):
    Promise<T.StepRunGetOutput>;
}
