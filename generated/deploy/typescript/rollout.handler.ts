// generated: rollout.handler.ts
import type { ConceptStorage } from "@copf/runtime";
import type * as T from "./rollout.types";

export interface RolloutHandler {
  begin(input: T.RolloutBeginInput, storage: ConceptStorage):
    Promise<T.RolloutBeginOutput>;
  advance(input: T.RolloutAdvanceInput, storage: ConceptStorage):
    Promise<T.RolloutAdvanceOutput>;
  pause(input: T.RolloutPauseInput, storage: ConceptStorage):
    Promise<T.RolloutPauseOutput>;
  resume(input: T.RolloutResumeInput, storage: ConceptStorage):
    Promise<T.RolloutResumeOutput>;
  abort(input: T.RolloutAbortInput, storage: ConceptStorage):
    Promise<T.RolloutAbortOutput>;
  status(input: T.RolloutStatusInput, storage: ConceptStorage):
    Promise<T.RolloutStatusOutput>;
}
