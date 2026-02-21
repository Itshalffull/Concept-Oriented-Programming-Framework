// generated: view.handler.ts
import type { ConceptStorage } from "@copf/runtime";
import type * as T from "./view.types";

export interface ViewHandler {
  create(input: T.ViewCreateInput, storage: ConceptStorage):
    Promise<T.ViewCreateOutput>;
  setFilter(input: T.ViewSetFilterInput, storage: ConceptStorage):
    Promise<T.ViewSetFilterOutput>;
  setSort(input: T.ViewSetSortInput, storage: ConceptStorage):
    Promise<T.ViewSetSortOutput>;
  setGroup(input: T.ViewSetGroupInput, storage: ConceptStorage):
    Promise<T.ViewSetGroupOutput>;
  setVisibleFields(input: T.ViewSetVisibleFieldsInput, storage: ConceptStorage):
    Promise<T.ViewSetVisibleFieldsOutput>;
  changeLayout(input: T.ViewChangeLayoutInput, storage: ConceptStorage):
    Promise<T.ViewChangeLayoutOutput>;
  duplicate(input: T.ViewDuplicateInput, storage: ConceptStorage):
    Promise<T.ViewDuplicateOutput>;
  embed(input: T.ViewEmbedInput, storage: ConceptStorage):
    Promise<T.ViewEmbedOutput>;
}
