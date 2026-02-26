// generated: element.handler.ts
import type { ConceptStorage } from "@clef/runtime";
import type * as T from "./element.types";

export interface ElementHandler {
  create(input: T.ElementCreateInput, storage: ConceptStorage):
    Promise<T.ElementCreateOutput>;
  nest(input: T.ElementNestInput, storage: ConceptStorage):
    Promise<T.ElementNestOutput>;
  setConstraints(input: T.ElementSetConstraintsInput, storage: ConceptStorage):
    Promise<T.ElementSetConstraintsOutput>;
  remove(input: T.ElementRemoveInput, storage: ConceptStorage):
    Promise<T.ElementRemoveOutput>;
}
