// generated: flag.handler.ts
import type { ConceptStorage } from "@copf/runtime";
import type * as T from "./flag.types";

export interface FlagHandler {
  flag(input: T.FlagFlagInput, storage: ConceptStorage):
    Promise<T.FlagFlagOutput>;
  unflag(input: T.FlagUnflagInput, storage: ConceptStorage):
    Promise<T.FlagUnflagOutput>;
  isFlagged(input: T.FlagIsFlaggedInput, storage: ConceptStorage):
    Promise<T.FlagIsFlaggedOutput>;
  getCount(input: T.FlagGetCountInput, storage: ConceptStorage):
    Promise<T.FlagGetCountOutput>;
}
