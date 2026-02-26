// generated: Authorization/Handler.swift

import Foundation

protocol AuthorizationHandler {
    func grantPermission(
        input: AuthorizationGrantPermissionInput,
        storage: ConceptStorage
    ) async throws -> AuthorizationGrantPermissionOutput

    func revokePermission(
        input: AuthorizationRevokePermissionInput,
        storage: ConceptStorage
    ) async throws -> AuthorizationRevokePermissionOutput

    func assignRole(
        input: AuthorizationAssignRoleInput,
        storage: ConceptStorage
    ) async throws -> AuthorizationAssignRoleOutput

    func checkPermission(
        input: AuthorizationCheckPermissionInput,
        storage: ConceptStorage
    ) async throws -> AuthorizationCheckPermissionOutput

}
