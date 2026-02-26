// generated: reference.handler.ts
import type { ConceptStorage } from "@clef/runtime";
import type * as T from "./reference.types";

export interface ReferenceHandler {
  addRef(input: T.ReferenceAddRefInput, storage: ConceptStorage):
    Promise<T.ReferenceAddRefOutput>;
  removeRef(input: T.ReferenceRemoveRefInput, storage: ConceptStorage):
    Promise<T.ReferenceRemoveRefOutput>;
  getRefs(input: T.ReferenceGetRefsInput, storage: ConceptStorage):
    Promise<T.ReferenceGetRefsOutput>;
  resolveTarget(input: T.ReferenceResolveTargetInput, storage: ConceptStorage):
    Promise<T.ReferenceResolveTargetOutput>;
}
