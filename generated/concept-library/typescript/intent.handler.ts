// generated: intent.handler.ts
import type { ConceptStorage } from "@copf/runtime";
import type * as T from "./intent.types";

export interface IntentHandler {
  define(input: T.IntentDefineInput, storage: ConceptStorage):
    Promise<T.IntentDefineOutput>;
  update(input: T.IntentUpdateInput, storage: ConceptStorage):
    Promise<T.IntentUpdateOutput>;
  verify(input: T.IntentVerifyInput, storage: ConceptStorage):
    Promise<T.IntentVerifyOutput>;
  discover(input: T.IntentDiscoverInput, storage: ConceptStorage):
    Promise<T.IntentDiscoverOutput>;
  suggestFromDescription(input: T.IntentSuggestFromDescriptionInput, storage: ConceptStorage):
    Promise<T.IntentSuggestFromDescriptionOutput>;
}
