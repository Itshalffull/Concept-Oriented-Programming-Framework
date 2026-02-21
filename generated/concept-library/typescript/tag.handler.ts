// generated: tag.handler.ts
import type { ConceptStorage } from "@copf/runtime";
import type * as T from "./tag.types";

export interface TagHandler {
  addTag(input: T.TagAddTagInput, storage: ConceptStorage):
    Promise<T.TagAddTagOutput>;
  removeTag(input: T.TagRemoveTagInput, storage: ConceptStorage):
    Promise<T.TagRemoveTagOutput>;
  getByTag(input: T.TagGetByTagInput, storage: ConceptStorage):
    Promise<T.TagGetByTagOutput>;
  getChildren(input: T.TagGetChildrenInput, storage: ConceptStorage):
    Promise<T.TagGetChildrenOutput>;
  rename(input: T.TagRenameInput, storage: ConceptStorage):
    Promise<T.TagRenameOutput>;
}
