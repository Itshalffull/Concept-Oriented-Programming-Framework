// generated: session.handler.ts
import type { ConceptStorage } from "@clef/runtime";
import type * as T from "./session.types";

export interface SessionHandler {
  create(input: T.SessionCreateInput, storage: ConceptStorage):
    Promise<T.SessionCreateOutput>;
  validate(input: T.SessionValidateInput, storage: ConceptStorage):
    Promise<T.SessionValidateOutput>;
  refresh(input: T.SessionRefreshInput, storage: ConceptStorage):
    Promise<T.SessionRefreshOutput>;
  destroy(input: T.SessionDestroyInput, storage: ConceptStorage):
    Promise<T.SessionDestroyOutput>;
  destroyAll(input: T.SessionDestroyAllInput, storage: ConceptStorage):
    Promise<T.SessionDestroyAllOutput>;
  getContext(input: T.SessionGetContextInput, storage: ConceptStorage):
    Promise<T.SessionGetContextOutput>;
}
