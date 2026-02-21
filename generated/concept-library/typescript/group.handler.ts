// generated: group.handler.ts
import type { ConceptStorage } from "@copf/runtime";
import type * as T from "./group.types";

export interface GroupHandler {
  createGroup(input: T.GroupCreateGroupInput, storage: ConceptStorage):
    Promise<T.GroupCreateGroupOutput>;
  addMember(input: T.GroupAddMemberInput, storage: ConceptStorage):
    Promise<T.GroupAddMemberOutput>;
  assignGroupRole(input: T.GroupAssignGroupRoleInput, storage: ConceptStorage):
    Promise<T.GroupAssignGroupRoleOutput>;
  addContent(input: T.GroupAddContentInput, storage: ConceptStorage):
    Promise<T.GroupAddContentOutput>;
  checkGroupAccess(input: T.GroupCheckGroupAccessInput, storage: ConceptStorage):
    Promise<T.GroupCheckGroupAccessOutput>;
}
