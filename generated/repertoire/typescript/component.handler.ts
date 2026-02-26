// generated: component.handler.ts
import type { ConceptStorage } from "@clef/runtime";
import type * as T from "./component.types";

export interface ComponentHandler {
  register(input: T.ComponentRegisterInput, storage: ConceptStorage):
    Promise<T.ComponentRegisterOutput>;
  render(input: T.ComponentRenderInput, storage: ConceptStorage):
    Promise<T.ComponentRenderOutput>;
  place(input: T.ComponentPlaceInput, storage: ConceptStorage):
    Promise<T.ComponentPlaceOutput>;
  setVisibility(input: T.ComponentSetVisibilityInput, storage: ConceptStorage):
    Promise<T.ComponentSetVisibilityOutput>;
  evaluateVisibility(input: T.ComponentEvaluateVisibilityInput, storage: ConceptStorage):
    Promise<T.ComponentEvaluateVisibilityOutput>;
}
