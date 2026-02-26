// generated: query.handler.ts
import type { ConceptStorage } from "@clef/runtime";
import type * as T from "./query.types";

export interface QueryHandler {
  parse(input: T.QueryParseInput, storage: ConceptStorage):
    Promise<T.QueryParseOutput>;
  execute(input: T.QueryExecuteInput, storage: ConceptStorage):
    Promise<T.QueryExecuteOutput>;
  subscribe(input: T.QuerySubscribeInput, storage: ConceptStorage):
    Promise<T.QuerySubscribeOutput>;
  addFilter(input: T.QueryAddFilterInput, storage: ConceptStorage):
    Promise<T.QueryAddFilterOutput>;
  addSort(input: T.QueryAddSortInput, storage: ConceptStorage):
    Promise<T.QueryAddSortOutput>;
  setScope(input: T.QuerySetScopeInput, storage: ConceptStorage):
    Promise<T.QuerySetScopeOutput>;
}
