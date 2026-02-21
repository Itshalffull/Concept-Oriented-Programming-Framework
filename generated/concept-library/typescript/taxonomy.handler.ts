// generated: taxonomy.handler.ts
import type { ConceptStorage } from "@copf/runtime";
import type * as T from "./taxonomy.types";

export interface TaxonomyHandler {
  createVocabulary(input: T.TaxonomyCreateVocabularyInput, storage: ConceptStorage):
    Promise<T.TaxonomyCreateVocabularyOutput>;
  addTerm(input: T.TaxonomyAddTermInput, storage: ConceptStorage):
    Promise<T.TaxonomyAddTermOutput>;
  setParent(input: T.TaxonomySetParentInput, storage: ConceptStorage):
    Promise<T.TaxonomySetParentOutput>;
  tagEntity(input: T.TaxonomyTagEntityInput, storage: ConceptStorage):
    Promise<T.TaxonomyTagEntityOutput>;
  untagEntity(input: T.TaxonomyUntagEntityInput, storage: ConceptStorage):
    Promise<T.TaxonomyUntagEntityOutput>;
}
