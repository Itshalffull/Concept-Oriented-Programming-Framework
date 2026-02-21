// generated: contentnode.handler.ts
import type { ConceptStorage } from "@copf/runtime";
import type * as T from "./contentnode.types";

export interface ContentNodeHandler {
  create(input: T.ContentNodeCreateInput, storage: ConceptStorage):
    Promise<T.ContentNodeCreateOutput>;
  update(input: T.ContentNodeUpdateInput, storage: ConceptStorage):
    Promise<T.ContentNodeUpdateOutput>;
  delete(input: T.ContentNodeDeleteInput, storage: ConceptStorage):
    Promise<T.ContentNodeDeleteOutput>;
  get(input: T.ContentNodeGetInput, storage: ConceptStorage):
    Promise<T.ContentNodeGetOutput>;
  setMetadata(input: T.ContentNodeSetMetadataInput, storage: ConceptStorage):
    Promise<T.ContentNodeSetMetadataOutput>;
  changeType(input: T.ContentNodeChangeTypeInput, storage: ConceptStorage):
    Promise<T.ContentNodeChangeTypeOutput>;
}
