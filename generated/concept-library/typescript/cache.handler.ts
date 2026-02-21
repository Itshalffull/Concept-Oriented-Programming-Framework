// generated: cache.handler.ts
import type { ConceptStorage } from "@copf/runtime";
import type * as T from "./cache.types";

export interface CacheHandler {
  set(input: T.CacheSetInput, storage: ConceptStorage):
    Promise<T.CacheSetOutput>;
  get(input: T.CacheGetInput, storage: ConceptStorage):
    Promise<T.CacheGetOutput>;
  invalidate(input: T.CacheInvalidateInput, storage: ConceptStorage):
    Promise<T.CacheInvalidateOutput>;
  invalidateByTags(input: T.CacheInvalidateByTagsInput, storage: ConceptStorage):
    Promise<T.CacheInvalidateByTagsOutput>;
}
