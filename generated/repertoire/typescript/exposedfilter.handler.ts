// generated: exposedfilter.handler.ts
import type { ConceptStorage } from "@clef/runtime";
import type * as T from "./exposedfilter.types";

export interface ExposedFilterHandler {
  expose(input: T.ExposedFilterExposeInput, storage: ConceptStorage):
    Promise<T.ExposedFilterExposeOutput>;
  collectInput(input: T.ExposedFilterCollectInputInput, storage: ConceptStorage):
    Promise<T.ExposedFilterCollectInputOutput>;
  applyToQuery(input: T.ExposedFilterApplyToQueryInput, storage: ConceptStorage):
    Promise<T.ExposedFilterApplyToQueryOutput>;
  resetToDefaults(input: T.ExposedFilterResetToDefaultsInput, storage: ConceptStorage):
    Promise<T.ExposedFilterResetToDefaultsOutput>;
}
