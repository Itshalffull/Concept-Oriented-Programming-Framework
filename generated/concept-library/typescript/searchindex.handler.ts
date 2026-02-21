// generated: searchindex.handler.ts
import type { ConceptStorage } from "@copf/runtime";
import type * as T from "./searchindex.types";

export interface SearchIndexHandler {
  createIndex(input: T.SearchIndexCreateIndexInput, storage: ConceptStorage):
    Promise<T.SearchIndexCreateIndexOutput>;
  indexItem(input: T.SearchIndexIndexItemInput, storage: ConceptStorage):
    Promise<T.SearchIndexIndexItemOutput>;
  removeItem(input: T.SearchIndexRemoveItemInput, storage: ConceptStorage):
    Promise<T.SearchIndexRemoveItemOutput>;
  search(input: T.SearchIndexSearchInput, storage: ConceptStorage):
    Promise<T.SearchIndexSearchOutput>;
  addProcessor(input: T.SearchIndexAddProcessorInput, storage: ConceptStorage):
    Promise<T.SearchIndexAddProcessorOutput>;
  reindex(input: T.SearchIndexReindexInput, storage: ConceptStorage):
    Promise<T.SearchIndexReindexOutput>;
}
