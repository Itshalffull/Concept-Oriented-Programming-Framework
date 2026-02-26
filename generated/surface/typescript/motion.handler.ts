// generated: motion.handler.ts
import type { ConceptStorage } from "@clef/runtime";
import type * as T from "./motion.types";

export interface MotionHandler {
  defineDuration(input: T.MotionDefineDurationInput, storage: ConceptStorage):
    Promise<T.MotionDefineDurationOutput>;
  defineEasing(input: T.MotionDefineEasingInput, storage: ConceptStorage):
    Promise<T.MotionDefineEasingOutput>;
  defineTransition(input: T.MotionDefineTransitionInput, storage: ConceptStorage):
    Promise<T.MotionDefineTransitionOutput>;
}
