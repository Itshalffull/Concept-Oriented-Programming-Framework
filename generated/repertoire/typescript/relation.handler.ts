// generated: relation.handler.ts
import type { ConceptStorage } from "@clef/runtime";
import type * as T from "./relation.types";

export interface RelationHandler {
  defineRelation(input: T.RelationDefineRelationInput, storage: ConceptStorage):
    Promise<T.RelationDefineRelationOutput>;
  link(input: T.RelationLinkInput, storage: ConceptStorage):
    Promise<T.RelationLinkOutput>;
  unlink(input: T.RelationUnlinkInput, storage: ConceptStorage):
    Promise<T.RelationUnlinkOutput>;
  getRelated(input: T.RelationGetRelatedInput, storage: ConceptStorage):
    Promise<T.RelationGetRelatedOutput>;
  defineRollup(input: T.RelationDefineRollupInput, storage: ConceptStorage):
    Promise<T.RelationDefineRollupOutput>;
  computeRollup(input: T.RelationComputeRollupInput, storage: ConceptStorage):
    Promise<T.RelationComputeRollupOutput>;
}
