// generated: timer.handler.ts
import type { ConceptStorage } from "@clef/runtime";
import type * as T from "./timer.types";

export interface TimerHandler {
  setTimer(input: T.TimerSetTimerInput, storage: ConceptStorage):
    Promise<T.TimerSetTimerOutput>;
  fire(input: T.TimerFireInput, storage: ConceptStorage):
    Promise<T.TimerFireOutput>;
  cancel(input: T.TimerCancelInput, storage: ConceptStorage):
    Promise<T.TimerCancelOutput>;
  reset(input: T.TimerResetInput, storage: ConceptStorage):
    Promise<T.TimerResetOutput>;
}
