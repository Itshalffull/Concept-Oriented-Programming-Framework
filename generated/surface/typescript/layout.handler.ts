// generated: layout.handler.ts
import type { ConceptStorage } from "@clef/runtime";
import type * as T from "./layout.types";

export interface LayoutHandler {
  create(input: T.LayoutCreateInput, storage: ConceptStorage):
    Promise<T.LayoutCreateOutput>;
  configure(input: T.LayoutConfigureInput, storage: ConceptStorage):
    Promise<T.LayoutConfigureOutput>;
  nest(input: T.LayoutNestInput, storage: ConceptStorage):
    Promise<T.LayoutNestOutput>;
  setResponsive(input: T.LayoutSetResponsiveInput, storage: ConceptStorage):
    Promise<T.LayoutSetResponsiveOutput>;
  remove(input: T.LayoutRemoveInput, storage: ConceptStorage):
    Promise<T.LayoutRemoveOutput>;
}
