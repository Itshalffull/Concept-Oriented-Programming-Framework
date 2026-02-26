// generated: outline.handler.ts
import type { ConceptStorage } from "@clef/runtime";
import type * as T from "./outline.types";

export interface OutlineHandler {
  create(input: T.OutlineCreateInput, storage: ConceptStorage):
    Promise<T.OutlineCreateOutput>;
  indent(input: T.OutlineIndentInput, storage: ConceptStorage):
    Promise<T.OutlineIndentOutput>;
  outdent(input: T.OutlineOutdentInput, storage: ConceptStorage):
    Promise<T.OutlineOutdentOutput>;
  moveUp(input: T.OutlineMoveUpInput, storage: ConceptStorage):
    Promise<T.OutlineMoveUpOutput>;
  moveDown(input: T.OutlineMoveDownInput, storage: ConceptStorage):
    Promise<T.OutlineMoveDownOutput>;
  collapse(input: T.OutlineCollapseInput, storage: ConceptStorage):
    Promise<T.OutlineCollapseOutput>;
  expand(input: T.OutlineExpandInput, storage: ConceptStorage):
    Promise<T.OutlineExpandOutput>;
  reparent(input: T.OutlineReparentInput, storage: ConceptStorage):
    Promise<T.OutlineReparentOutput>;
  getChildren(input: T.OutlineGetChildrenInput, storage: ConceptStorage):
    Promise<T.OutlineGetChildrenOutput>;
}
