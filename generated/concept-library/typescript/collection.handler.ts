// generated: collection.handler.ts
import type { ConceptStorage } from "@copf/runtime";
import type * as T from "./collection.types";

export interface CollectionHandler {
  create(input: T.CollectionCreateInput, storage: ConceptStorage):
    Promise<T.CollectionCreateOutput>;
  addMember(input: T.CollectionAddMemberInput, storage: ConceptStorage):
    Promise<T.CollectionAddMemberOutput>;
  removeMember(input: T.CollectionRemoveMemberInput, storage: ConceptStorage):
    Promise<T.CollectionRemoveMemberOutput>;
  getMembers(input: T.CollectionGetMembersInput, storage: ConceptStorage):
    Promise<T.CollectionGetMembersOutput>;
  setSchema(input: T.CollectionSetSchemaInput, storage: ConceptStorage):
    Promise<T.CollectionSetSchemaOutput>;
  createVirtual(input: T.CollectionCreateVirtualInput, storage: ConceptStorage):
    Promise<T.CollectionCreateVirtualOutput>;
  materialize(input: T.CollectionMaterializeInput, storage: ConceptStorage):
    Promise<T.CollectionMaterializeOutput>;
}
