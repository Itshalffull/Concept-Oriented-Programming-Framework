// generated: authorization.handler.ts
import type { ConceptStorage } from "@copf/runtime";
import type * as T from "./authorization.types";

export interface AuthorizationHandler {
  grantPermission(input: T.AuthorizationGrantPermissionInput, storage: ConceptStorage):
    Promise<T.AuthorizationGrantPermissionOutput>;
  revokePermission(input: T.AuthorizationRevokePermissionInput, storage: ConceptStorage):
    Promise<T.AuthorizationRevokePermissionOutput>;
  assignRole(input: T.AuthorizationAssignRoleInput, storage: ConceptStorage):
    Promise<T.AuthorizationAssignRoleOutput>;
  checkPermission(input: T.AuthorizationCheckPermissionInput, storage: ConceptStorage):
    Promise<T.AuthorizationCheckPermissionOutput>;
}
